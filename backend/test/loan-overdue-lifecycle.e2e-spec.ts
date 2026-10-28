import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, CanActivate, Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { LoanStatus, ReminderStatus, ReminderType } from '@prisma/client';
import { HistoryController } from '../src/history/history.controller';
import { HistoryService } from '../src/history/history.service';
import { LoansCronService } from '../src/loans/loans-cron.service';
import { ReminderExhaustedListener } from '../src/loans/reminder-exhausted.listener';
import { BorrowerStatsListener } from '../src/borrowers/borrower-stats.listener';
import { RemindersCronService } from '../src/reminders/reminders-cron.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { LOAN_EVENTS } from '../src/common/events/loan.events';

// =============================================================================
// FEAT-10 — full lifecycle: ACTIVE → (tick) AWAITING_RETURN → reminders →
// ALL_EXHAUSTED → NOT_RETURNED, with borrower stats / trustScore and
// GET /history/statistics.
//
// What is real: LoansCronService, ReminderExhaustedListener, BorrowerStatsListener,
// RemindersCronService, HistoryService/Controller, EventEmitter2 wiring, state
// machine, HTTP layer.
// What is faked: PrismaService (jest-mock-extended) backed by a tiny in-memory
// store that interprets only the `where` clauses used by these services. It proves
// the application logic and the event chain, NOT the real SQL / @db.Date behaviour.
// =============================================================================

const LENDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';
const RETURNED_LOAN_ID = '110e8400-e29b-41d4-a716-446655440001';

// returnDate is a @db.Date → midnight UTC
const RETURN_DATE = new Date('2026-03-10T00:00:00.000Z');

interface FakeReminder {
  id: string;
  type: ReminderType;
  status: ReminderStatus;
  scheduledFor: Date;
}

interface FakeLoan {
  id: string;
  status: LoanStatus;
  lenderId: string;
  borrowerId: string;
  returnDate: Date | null;
  returnedDate: Date | null;
  deletedAt: Date | null;
  reminders: FakeReminder[];
  itemId: string;
  item: Record<string, unknown>;
  borrower: Record<string, unknown>;
}

interface FakeBorrower {
  id: string;
  totalLoans: number;
  trustScore: number | null;
  returnedOnTime: number;
  returnedLate: number;
  notReturned: number;
}

type Where = Record<string, unknown>;

function matchesScalar(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) {
    return (
      value === cond ||
      (value instanceof Date && cond instanceof Date ? value.getTime() === cond.getTime() : false)
    );
  }
  const c = cond as { in?: unknown[]; not?: unknown; lt?: Date };
  if (c.in && !c.in.includes(value)) return false;
  if ('not' in c && value === c.not) return false;
  if (c.lt && !(value instanceof Date && value.getTime() < c.lt.getTime())) return false;
  return true;
}

function matchesReminder(reminder: FakeReminder, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) =>
    matchesScalar((reminder as unknown as Record<string, unknown>)[key], cond),
  );
}

function matchesLoan(loan: FakeLoan, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'reminders') {
      const some = (cond as { some: Where }).some;
      return loan.reminders.some((r) => matchesReminder(r, some));
    }
    return matchesScalar((loan as unknown as Record<string, unknown>)[key], cond);
  });
}

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = { userId: LENDER_ID, email: 'l@example.com' };
    return true;
  }
}

/** Event handlers are async and not awaited by emit(): let them settle. */
async function flushEvents(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

describe('FEAT-10 overdue lifecycle (e2e, in-memory Prisma fake)', () => {
  let app: INestApplication<App>;
  let prisma: DeepMockProxy<PrismaService>;
  let loansCron: LoansCronService;
  let remindersCron: RemindersCronService;
  let emitSpy: jest.SpyInstance;
  let loans: FakeLoan[];
  let borrower: FakeBorrower;

  const mainLoan = (): FakeLoan => loans.find((l) => l.id === LOAN_ID) as FakeLoan;

  function setNow(iso: string): void {
    jest.setSystemTime(new Date(iso));
  }

  function statusChanges(): Array<{ loanId: string; previousStatus: string; newStatus: string }> {
    return emitSpy.mock.calls
      .filter(([name]) => name === LOAN_EVENTS.STATUS_CHANGED)
      .map(([, payload]) => payload);
  }

  function buildLoan(id: string, status: LoanStatus, reminders: FakeReminder[]): FakeLoan {
    return {
      id,
      status,
      lenderId: LENDER_ID,
      borrowerId: BORROWER_ID,
      returnDate: RETURN_DATE,
      returnedDate: null,
      deletedAt: null,
      reminders,
      itemId: 'item-1',
      item: {
        id: 'item-1',
        name: 'Drill',
        description: null,
        category: 'TOOLS',
        estimatedValue: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        photos: [],
      },
      borrower: {
        id: BORROWER_ID,
        firstName: 'Marie',
        lastName: 'Dupont',
        trustScore: null,
        user: null,
      },
    };
  }

  function reminder(type: ReminderType, scheduledFor: string): FakeReminder {
    return {
      id: `rem-${type}`,
      type,
      status: ReminderStatus.SCHEDULED,
      scheduledFor: new Date(scheduledFor),
    };
  }

  function wirePrismaFake(): void {
    prisma.loan.findMany.mockImplementation(((args: {
      where: Where;
      select?: { reminders?: { where?: Where } };
    }) => {
      const nested = args.select?.reminders?.where;
      return Promise.resolve(
        loans
          .filter((l) => matchesLoan(l, args.where))
          .map((l) => ({
            ...l,
            createdAt: new Date('2026-02-20T00:00:00.000Z'),
            reminders: nested ? l.reminders.filter((r) => matchesReminder(r, nested)) : l.reminders,
          })),
      );
    }) as never);
    prisma.loan.count.mockImplementation(((args: { where: Where }) =>
      Promise.resolve(loans.filter((l) => matchesLoan(l, args.where)).length)) as never);
    prisma.loan.findUnique.mockImplementation(((args: { where: { id: string } }) =>
      Promise.resolve(loans.find((l) => l.id === args.where.id) ?? null)) as never);
    prisma.loan.update.mockImplementation(((args: {
      where: { id: string };
      data: Partial<FakeLoan>;
    }) => {
      const loan = loans.find((l) => l.id === args.where.id) as FakeLoan;
      Object.assign(loan, args.data);
      return Promise.resolve(loan);
    }) as never);
    // Guarded update: only touches a row still in the expected status (idempotence)
    prisma.loan.updateMany.mockImplementation(((args: {
      where: Where;
      data: Partial<FakeLoan>;
    }) => {
      const matching = loans.filter((l) => matchesLoan(l, args.where));
      matching.forEach((l) => Object.assign(l, args.data));
      return Promise.resolve({ count: matching.length });
    }) as never);

    prisma.borrower.findUnique.mockImplementation((() => Promise.resolve(borrower)) as never);
    prisma.borrower.update.mockImplementation(((args: { data: Partial<FakeBorrower> }) => {
      Object.assign(borrower, args.data);
      return Promise.resolve(borrower);
    }) as never);

    prisma.reminder.findMany.mockImplementation((() => {
      const now = Date.now();
      const due = loans.flatMap((l) =>
        l.reminders
          .filter((r) => r.status === ReminderStatus.SCHEDULED && r.scheduledFor.getTime() <= now)
          .map((r) => ({
            ...r,
            loan: {
              id: l.id,
              borrowerId: l.borrowerId,
              lenderId: l.lenderId,
              borrower: { userId: null },
            },
          })),
      );
      return Promise.resolve(due);
    }) as never);
    prisma.reminder.update.mockImplementation(((args: {
      where: { id: string };
      data: Partial<FakeReminder>;
    }) => {
      const target = loans.flatMap((l) => l.reminders).find((r) => r.id === args.where.id);
      if (target) Object.assign(target, args.data);
      return Promise.resolve(target);
    }) as never);
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    prisma = mockDeep<PrismaService>();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [HistoryController],
      providers: [
        HistoryService,
        LoansCronService,
        ReminderExhaustedListener,
        BorrowerStatsListener,
        RemindersCronService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { sendReminderNotification: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    loansCron = app.get(LoansCronService);
    remindersCron = app.get(RemindersCronService);
    emitSpy = jest.spyOn(app.get(EventEmitter2), 'emit');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  beforeEach(() => {
    // Only Date is faked: timers/immediates stay real so supertest and event
    // handlers keep working.
    jest.useFakeTimers({
      doNotFake: [
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'nextTick',
        'queueMicrotask',
      ],
    });
    setNow('2026-03-05T08:00:00.000Z');
    emitSpy.mockClear();

    // One loan that will go all the way, plus one loan already RETURNED on time.
    loans = [
      buildLoan(LOAN_ID, LoanStatus.ACTIVE, [
        reminder(ReminderType.ON_DUE_DATE, '2026-03-10T08:00:00.000Z'),
        reminder(ReminderType.FIRST_OVERDUE, '2026-03-17T08:00:00.000Z'),
        reminder(ReminderType.SECOND_OVERDUE, '2026-03-24T08:00:00.000Z'),
        reminder(ReminderType.FINAL_OVERDUE, '2026-03-31T08:00:00.000Z'),
      ]),
      {
        ...buildLoan(RETURNED_LOAN_ID, LoanStatus.RETURNED, []),
        returnedDate: new Date('2026-03-09T00:00:00.000Z'),
      },
    ];
    borrower = {
      id: BORROWER_ID,
      totalLoans: 2,
      trustScore: null,
      returnedOnTime: 0,
      returnedLate: 0,
      notReturned: 0,
    };
    wirePrismaFake();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('walks ACTIVE → AWAITING_RETURN → NOT_RETURNED and updates statistics and trustScore', async () => {
    // Day J (due day): still on time, nothing happens
    setNow('2026-03-10T23:59:59.000Z');
    await loansCron.handleOverdueLoans();
    expect(mainLoan().status).toBe(LoanStatus.ACTIVE);
    expect(statusChanges()).toHaveLength(0);

    // Before: nothing is "not returned", trustScore unrated
    let stats = await request(app.getHttpServer()).get('/v1/history/statistics').expect(200);
    expect(stats.body.overview.notReturnedLoans).toBe(0);
    expect(borrower.trustScore).toBeNull();

    // J+1 00:00 UTC: first tick flips it to AWAITING_RETURN, one event
    setNow('2026-03-11T00:00:00.000Z');
    await loansCron.handleOverdueLoans();
    await flushEvents();
    expect(mainLoan().status).toBe(LoanStatus.AWAITING_RETURN);
    expect(statusChanges()).toEqual([
      expect.objectContaining({
        loanId: LOAN_ID,
        previousStatus: LoanStatus.ACTIVE,
        newStatus: LoanStatus.AWAITING_RETURN,
      }),
    ]);

    // A second tick is a no-op (idempotence): no extra event
    setNow('2026-03-11T01:00:00.000Z');
    await loansCron.handleOverdueLoans();
    expect(statusChanges()).toHaveLength(1);

    // Intermediate reminders are sent; the loan stays AWAITING_RETURN
    setNow('2026-03-24T09:00:00.000Z');
    await remindersCron.sendScheduledReminders();
    await flushEvents();
    expect(mainLoan().status).toBe(LoanStatus.AWAITING_RETURN);
    expect(mainLoan().reminders.filter((r) => r.status === ReminderStatus.SENT)).toHaveLength(3);

    // FINAL_OVERDUE sent → ALL_EXHAUSTED → listener → NOT_RETURNED
    setNow('2026-03-31T09:00:00.000Z');
    await remindersCron.sendScheduledReminders();
    await flushEvents();
    expect(mainLoan().status).toBe(LoanStatus.NOT_RETURNED);
    expect(statusChanges().map((e) => e.newStatus)).toEqual([
      LoanStatus.AWAITING_RETURN,
      LoanStatus.NOT_RETURNED,
    ]);

    // Borrower stats: 1 returned on time + 1 not returned → trustScore 50
    expect(borrower.notReturned).toBe(1);
    expect(borrower.returnedOnTime).toBe(1);
    expect(borrower.trustScore).toBe(50);

    // Endpoint reflects it
    stats = await request(app.getHttpServer()).get('/v1/history/statistics').expect(200);
    expect(stats.body.overview.notReturnedLoans).toBe(1);
    expect(stats.body.overview.returnedLoans).toBe(1);

    // Catch-up tick afterwards has nothing left to do and emits nothing more
    await loansCron.handleOverdueLoans();
    expect(statusChanges()).toHaveLength(2);
  });

  it('catch-up: an overdue loan whose FINAL_OVERDUE was already SENT is closed on the first tick', async () => {
    const stuck = mainLoan();
    stuck.reminders.forEach((r) => (r.status = ReminderStatus.SENT));
    setNow('2026-04-15T10:00:00.000Z');

    await loansCron.handleOverdueLoans();
    await flushEvents();

    expect(stuck.status).toBe(LoanStatus.NOT_RETURNED);
    expect(statusChanges().map((e) => [e.previousStatus, e.newStatus])).toEqual([
      [LoanStatus.ACTIVE, LoanStatus.AWAITING_RETURN],
      [LoanStatus.AWAITING_RETURN, LoanStatus.NOT_RETURNED],
    ]);
    expect(borrower.notReturned).toBe(1);
    expect(borrower.trustScore).toBe(50);

    const stats = await request(app.getHttpServer()).get('/v1/history/statistics').expect(200);
    expect(stats.body.overview.notReturnedLoans).toBe(1);
  });

  describe('FEAT-10 exclusions (behaviour on the in-memory store)', () => {
    const OTHER_BASE = '110e8400-e29b-41d4-a716-4466554400';

    function addLoan(suffix: string, overrides: Partial<FakeLoan>): FakeLoan {
      const loan = { ...buildLoan(`${OTHER_BASE}${suffix}`, LoanStatus.ACTIVE, []), ...overrides };
      loans.push(loan);
      return loan;
    }

    it('only flips the eligible loan and leaves every excluded one untouched', async () => {
      loans = []; // isolate from the default fixtures
      const eligible = addLoan('10', {});
      const excluded = [
        addLoan('11', { returnDate: null }),
        addLoan('12', { deletedAt: new Date('2026-03-01T00:00:00.000Z') }),
        addLoan('13', { status: LoanStatus.CONTESTED }),
        addLoan('14', { status: LoanStatus.RETURNED }),
        addLoan('15', { status: LoanStatus.PENDING_CONFIRMATION }),
        addLoan('16', { returnDate: new Date('2026-03-11T00:00:00.000Z') }), // due today
      ];
      setNow('2026-03-11T10:00:00.000Z');

      await loansCron.handleOverdueLoans();
      await flushEvents();

      expect(eligible.status).toBe(LoanStatus.AWAITING_RETURN);
      expect(excluded.map((l) => l.status)).toEqual([
        LoanStatus.ACTIVE,
        LoanStatus.ACTIVE,
        LoanStatus.CONTESTED,
        LoanStatus.RETURNED,
        LoanStatus.PENDING_CONFIRMATION,
        LoanStatus.ACTIVE,
      ]);
      expect(statusChanges().map((e) => e.loanId)).toEqual([eligible.id]);
    });

    it('catch-up never closes a soft-deleted or RETURNED loan, even with a SENT FINAL_OVERDUE', async () => {
      loans = [];
      const sent = [reminder(ReminderType.FINAL_OVERDUE, '2026-03-31T08:00:00.000Z')].map((r) => ({
        ...r,
        status: ReminderStatus.SENT,
      }));
      const deleted = addLoan('21', {
        status: LoanStatus.AWAITING_RETURN,
        deletedAt: new Date('2026-04-01T00:00:00.000Z'),
        reminders: sent,
      });
      const returned = addLoan('22', { status: LoanStatus.RETURNED, reminders: sent });
      setNow('2026-04-15T10:00:00.000Z');

      await loansCron.handleOverdueLoans();
      await flushEvents();

      expect(deleted.status).toBe(LoanStatus.AWAITING_RETURN);
      expect(returned.status).toBe(LoanStatus.RETURNED);
      expect(statusChanges()).toHaveLength(0);
    });

    it('catch-up closes a loan whose FINAL_OVERDUE FAILED but not one whose SENT FINAL_OVERDUE is for an older due date', async () => {
      loans = [];
      const failed = addLoan('31', {
        status: LoanStatus.AWAITING_RETURN,
        reminders: [
          {
            ...reminder(ReminderType.FINAL_OVERDUE, '2026-03-31T08:00:00.000Z'),
            status: ReminderStatus.FAILED,
          },
        ],
      });
      const postponed = addLoan('32', {
        status: LoanStatus.AWAITING_RETURN,
        returnDate: new Date('2026-03-20T00:00:00.000Z'), // pushed back after the J+21 of 03-10
        reminders: [
          {
            ...reminder(ReminderType.FINAL_OVERDUE, '2026-03-31T08:00:00.000Z'),
            id: 'rem-old',
            status: ReminderStatus.SENT,
          },
        ],
      });
      setNow('2026-04-15T10:00:00.000Z');

      await loansCron.handleOverdueLoans();
      await flushEvents();

      expect(failed.status).toBe(LoanStatus.NOT_RETURNED);
      expect(postponed.status).toBe(LoanStatus.AWAITING_RETURN);
    });
  });
});
