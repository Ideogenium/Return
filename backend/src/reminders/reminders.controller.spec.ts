import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ReminderStatus, ReminderType, NotificationChannel } from '@prisma/client';

import { RemindersController } from './reminders.controller.js';
import { RemindersService } from './reminders.service.js';
import type { ReminderWithLoan } from './reminders.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/exceptions/problem-details.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type { ReminderResponse } from './interfaces/reminder-response.interface.js';

// =============================================================================
// Fixtures
// =============================================================================

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const LOAN_ID = '110e8400-e29b-41d4-a716-446655440000';
const REMINDER_ID = 'aaa00000-e29b-41d4-a716-446655440000';

const MOCK_AUTH_USER: AuthenticatedUser = {
  userId: LENDER_USER_ID,
  email: 'lender@example.com',
  role: 'LENDER',
  jti: 'jti-123',
  tokenExp: Math.floor(Date.now() / 1000) + 900,
};

const MOCK_OTHER_AUTH_USER: AuthenticatedUser = {
  userId: OTHER_USER_ID,
  email: 'other@example.com',
  role: 'LENDER',
  jti: 'jti-456',
  tokenExp: Math.floor(Date.now() / 1000) + 900,
};

const NOW = new Date('2026-04-07T10:00:00.000Z');
const SCHEDULED_FOR = new Date('2026-04-10T00:00:00.000Z');

const MOCK_REMINDER_WITH_LOAN: ReminderWithLoan = {
  id: REMINDER_ID,
  loanId: LOAN_ID,
  type: ReminderType.PREVENTIVE,
  status: ReminderStatus.SCHEDULED,
  scheduledFor: SCHEDULED_FOR,
  sentAt: null,
  message: null,
  channel: NotificationChannel.PUSH,
  createdAt: NOW,
  updatedAt: NOW,
  loan: { id: LOAN_ID, lenderId: LENDER_USER_ID, borrowerUserId: BORROWER_USER_ID },
};

const MOCK_SENT_REMINDER_WITH_LOAN: ReminderWithLoan = {
  ...MOCK_REMINDER_WITH_LOAN,
  status: ReminderStatus.SENT,
  sentAt: new Date('2026-04-10T08:00:00.000Z'),
};

const MOCK_REMINDER_RESPONSE: ReminderResponse = {
  id: REMINDER_ID,
  loanId: LOAN_ID,
  type: ReminderType.PREVENTIVE,
  status: ReminderStatus.SCHEDULED,
  scheduledFor: SCHEDULED_FOR.toISOString(),
  sentAt: null,
  channel: NotificationChannel.PUSH,
};

// =============================================================================
// Test Suite
// =============================================================================

describe('RemindersController', () => {
  let controller: RemindersController;
  let remindersService: DeepMockProxy<RemindersService>;

  beforeEach(async () => {
    remindersService = mockDeep<RemindersService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [{ provide: RemindersService, useValue: remindersService }],
    }).compile();

    controller = module.get<RemindersController>(RemindersController);
  });

  // ===========================================================================
  // GET /v1/loans/:loanId/reminders
  // ===========================================================================

  describe('findByLoan', () => {
    it('should return all reminders for a loan', async () => {
      remindersService.findLoanForReminders.mockResolvedValue({
        id: LOAN_ID,
        lenderId: LENDER_USER_ID,
        borrowerUserId: BORROWER_USER_ID,
      });
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      remindersService.findByLoanId.mockResolvedValue([MOCK_REMINDER_RESPONSE]);

      const mockReq = { user: MOCK_AUTH_USER };
      const result = await controller.findByLoan(LOAN_ID, mockReq as never);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(MOCK_REMINDER_RESPONSE);
      expect(remindersService.findLoanForReminders).toHaveBeenCalledWith(
        LOAN_ID,
        `/v1/loans/${LOAN_ID}/reminders`,
      );
      expect(remindersService.assertLoanOwnership).toHaveBeenCalledWith(
        { id: LOAN_ID, lenderId: LENDER_USER_ID, borrowerUserId: BORROWER_USER_ID },
        LENDER_USER_ID,
        `/v1/loans/${LOAN_ID}/reminders`,
        { name: 'Loan', id: LOAN_ID },
      );
      expect(remindersService.findByLoanId).toHaveBeenCalledWith(LOAN_ID);
    });

    it('should throw 404 when loan does not exist', async () => {
      remindersService.findLoanForReminders.mockRejectedValue(
        new NotFoundException('Loan', LOAN_ID, `/v1/loans/${LOAN_ID}/reminders`),
      );
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.findByLoan(LOAN_ID, mockReq as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw 404 when loan is soft-deleted', async () => {
      remindersService.findLoanForReminders.mockRejectedValue(
        new NotFoundException('Loan', LOAN_ID, `/v1/loans/${LOAN_ID}/reminders`),
      );
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.findByLoan(LOAN_ID, mockReq as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw 403 when user is not the lender', async () => {
      remindersService.findLoanForReminders.mockResolvedValue({
        id: LOAN_ID,
        lenderId: LENDER_USER_ID,
        borrowerUserId: BORROWER_USER_ID,
      });
      remindersService.assertLoanOwnership.mockImplementation(() => {
        throw new ForbiddenException(
          'forbidden',
          'Forbidden',
          'Only the lender can access reminders for this loan.',
          `/v1/loans/${LOAN_ID}/reminders`,
        );
      });
      const mockReq = { user: MOCK_OTHER_AUTH_USER };

      await expect(controller.findByLoan(LOAN_ID, mockReq as never)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ===========================================================================
  // GET /v1/reminders/:reminderId
  // ===========================================================================

  describe('findById', () => {
    it('should return a single reminder', async () => {
      remindersService.findById.mockResolvedValue(MOCK_REMINDER_WITH_LOAN);
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      remindersService.toReminderResponse.mockReturnValue(MOCK_REMINDER_RESPONSE);
      const mockReq = { user: MOCK_AUTH_USER };

      const result = await controller.findById(REMINDER_ID, mockReq as never);

      expect(result).toEqual(MOCK_REMINDER_RESPONSE);
      expect(remindersService.findById).toHaveBeenCalledWith(REMINDER_ID);
      expect(remindersService.toReminderResponse).toHaveBeenCalledWith(MOCK_REMINDER_WITH_LOAN);
    });

    it('should throw 404 when reminder does not exist', async () => {
      remindersService.findById.mockResolvedValue(null);
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.findById(REMINDER_ID, mockReq as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw 403 when user is not the lender of the associated loan', async () => {
      remindersService.findById.mockResolvedValue({
        ...MOCK_REMINDER_WITH_LOAN,
        loan: { id: LOAN_ID, lenderId: OTHER_USER_ID, borrowerUserId: BORROWER_USER_ID },
      });
      remindersService.assertLoanOwnership.mockImplementation(() => {
        throw new ForbiddenException(
          'forbidden',
          'Forbidden',
          'Only the lender can access reminders for this loan.',
          `/v1/reminders/${REMINDER_ID}`,
        );
      });
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.findById(REMINDER_ID, mockReq as never)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ===========================================================================
  // POST /v1/reminders/:reminderId/cancel
  // ===========================================================================

  describe('cancel', () => {
    it('should cancel a SCHEDULED reminder (204)', async () => {
      remindersService.findById.mockResolvedValue(MOCK_REMINDER_WITH_LOAN);
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      remindersService.cancel.mockResolvedValue(undefined);
      const mockReq = { user: MOCK_AUTH_USER };

      await controller.cancel(REMINDER_ID, mockReq as never);

      expect(remindersService.cancel).toHaveBeenCalledWith(REMINDER_ID);
    });

    it('should throw 404 when reminder does not exist', async () => {
      remindersService.findById.mockResolvedValue(null);
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.cancel(REMINDER_ID, mockReq as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw 403 when user is not the lender', async () => {
      remindersService.findById.mockResolvedValue({
        ...MOCK_REMINDER_WITH_LOAN,
        loan: { id: LOAN_ID, lenderId: OTHER_USER_ID, borrowerUserId: BORROWER_USER_ID },
      });
      remindersService.assertLoanOwnership.mockImplementation(() => {
        throw new ForbiddenException(
          'forbidden',
          'Forbidden',
          'Only the lender can access reminders for this loan.',
          `/v1/reminders/${REMINDER_ID}/cancel`,
        );
      });
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.cancel(REMINDER_ID, mockReq as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw 409 when reminder is already SENT', async () => {
      remindersService.findById.mockResolvedValue(MOCK_SENT_REMINDER_WITH_LOAN);
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      const mockReq = { user: MOCK_AUTH_USER };

      await expect(controller.cancel(REMINDER_ID, mockReq as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should call cancel when reminder is FAILED (not blocked by controller)', async () => {
      remindersService.findById.mockResolvedValue({
        ...MOCK_REMINDER_WITH_LOAN,
        status: ReminderStatus.FAILED,
      });
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      remindersService.cancel.mockResolvedValue(undefined);
      const mockReq = { user: MOCK_AUTH_USER };

      await controller.cancel(REMINDER_ID, mockReq as never);

      expect(remindersService.cancel).toHaveBeenCalledWith(REMINDER_ID);
    });

    it('should call cancel when reminder is already CANCELLED (not blocked by controller)', async () => {
      remindersService.findById.mockResolvedValue({
        ...MOCK_REMINDER_WITH_LOAN,
        status: ReminderStatus.CANCELLED,
      });
      remindersService.assertLoanOwnership.mockReturnValue(undefined);
      remindersService.cancel.mockResolvedValue(undefined);
      const mockReq = { user: MOCK_AUTH_USER };

      await controller.cancel(REMINDER_ID, mockReq as never);

      expect(remindersService.cancel).toHaveBeenCalledWith(REMINDER_ID);
    });
  });
});

// =============================================================================
// FIX-28 — real RemindersService (Prisma mocked): third party = missing, borrower = 403
// =============================================================================

describe('RemindersController access rules (FIX-28)', () => {
  let controller: RemindersController;
  let prisma: DeepMockProxy<PrismaService>;

  const asUser = (userId: string): never => ({ user: { ...MOCK_AUTH_USER, userId } }) as never;

  /** Prisma row of a reminder whose loan is lent by LENDER_USER_ID to BORROWER_USER_ID. */
  const reminderRow = {
    ...MOCK_REMINDER_WITH_LOAN,
    loan: { id: LOAN_ID, lenderId: LENDER_USER_ID, borrower: { userId: BORROWER_USER_ID } },
  };
  const loanRow = {
    id: LOAN_ID,
    lenderId: LENDER_USER_ID,
    deletedAt: null,
    borrower: { userId: BORROWER_USER_ID },
  };

  /** The three routes, each given the id to probe and the caller; the resource exists or not. */
  const routes: [string, (userId: string) => Promise<unknown>, () => void, () => void][] = [
    [
      'GET /loans/:loanId/reminders',
      (userId) => controller.findByLoan(LOAN_ID, asUser(userId)),
      () => prisma.loan.findUnique.mockResolvedValue(loanRow as never),
      () => prisma.loan.findUnique.mockResolvedValue(null),
    ],
    [
      'GET /reminders/:reminderId',
      (userId) => controller.findById(REMINDER_ID, asUser(userId)),
      () => prisma.reminder.findUnique.mockResolvedValue(reminderRow as never),
      () => prisma.reminder.findUnique.mockResolvedValue(null),
    ],
    [
      'POST /reminders/:reminderId/cancel',
      (userId) => controller.cancel(REMINDER_ID, asUser(userId)),
      () => prisma.reminder.findUnique.mockResolvedValue(reminderRow as never),
      () => prisma.reminder.findUnique.mockResolvedValue(null),
    ],
  ];

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [RemindersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = module.get(RemindersController);
  });

  /** The body minus the per-response timestamp, which legitimately differs. */
  const withoutTimestamp = (error: NotFoundException): object => ({
    ...(error.getResponse() as object),
    timestamp: undefined,
  });

  const failureOf = async (call: Promise<unknown>): Promise<unknown> =>
    call.then(
      () => {
        throw new Error('expected the call to be rejected');
      },
      (error: unknown) => error,
    );

  it.each(routes)(
    '%s: a third party gets the exact 404 of a missing resource',
    async (_route, call, arrangeExisting, arrangeMissing) => {
      arrangeMissing();
      const missing = await failureOf(call(OTHER_USER_ID));
      arrangeExisting();
      const foreign = await failureOf(call(OTHER_USER_ID));

      expect(missing).toBeInstanceOf(NotFoundException);
      expect(foreign).toBeInstanceOf(NotFoundException);
      expect(withoutTimestamp(foreign as NotFoundException)).toEqual(
        withoutTimestamp(missing as NotFoundException),
      );
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    },
  );

  it.each(routes)(
    '%s: the borrower, a party to the loan, gets a 403',
    async (_route, call, arrangeExisting) => {
      arrangeExisting();

      expect(await failureOf(call(BORROWER_USER_ID))).toBeInstanceOf(ForbiddenException);
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    },
  );
});
