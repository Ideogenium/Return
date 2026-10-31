import { LoanStatus, ItemCategory, UserRole } from '@prisma/client';
import type { Loan, Item, Photo, User, Borrower } from '@prisma/client';
import { toLoanResponse, type LoanWithRelations } from './loan-response.mapper.js';

const LENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const BORROWER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '330e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2025-02-27T12:00:00Z');

const LENDER: User = {
  id: LENDER_USER_ID,
  email: 'lender@example.com',
  password: 'hashed',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.LENDER,
  profilePicture: null,
  phone: null,
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
  createdAt: NOW,
  updatedAt: NOW,
  lastLoginAt: null,
  deletedAt: null,
};

const ITEM: Item = {
  id: '220e8400-e29b-41d4-a716-446655440000',
  name: 'Perceuse',
  description: null,
  category: ItemCategory.TOOLS,
  estimatedValue: 150,
  userId: LENDER_USER_ID,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// The lender typed a nickname and a phone number in their contacts: neither must reach the borrower.
const CONTACT: Borrower = {
  id: BORROWER_ID,
  firstName: 'Mimi',
  lastName: 'Nickname',
  email: 'contact-typed-by-lender@example.com',
  phoneNumber: '+33612345678',
  userId: BORROWER_USER_ID,
  lenderUserId: LENDER_USER_ID,
  trustScore: 42,
  totalLoans: 3,
  returnedOnTime: 1,
  returnedLate: 1,
  notReturned: 1,
  averageReturnDelay: 4,
  createdAt: NOW,
  updatedAt: NOW,
};

const ACCOUNT = { firstName: 'Marie', lastName: 'Dupont', email: 'marie@example.com' };

// 'absent' leaves the relation unloaded (key missing), unlike null (no linked account).
function buildLoan(user: typeof ACCOUNT | null | 'absent' = ACCOUNT): LoanWithRelations {
  const loan: Loan = {
    id: '110e8400-e29b-41d4-a716-446655440000',
    itemId: ITEM.id,
    lenderId: LENDER_USER_ID,
    borrowerId: BORROWER_ID,
    status: LoanStatus.ACTIVE,
    returnDate: new Date('2025-06-01'),
    confirmationDate: null,
    returnedDate: null,
    notes: null,
    contestReason: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return {
    ...loan,
    item: { ...ITEM, photos: [] as Photo[] },
    lender: LENDER,
    borrower: { ...CONTACT, ...(user === 'absent' ? {} : { user }) },
  } as LoanWithRelations;
}

describe('toLoanResponse (viewer-dependent borrower)', () => {
  it('gives the lender the full contact with statistics', () => {
    const res = toLoanResponse(buildLoan(), LENDER_USER_ID);

    expect(res.borrower).toEqual({
      id: BORROWER_ID,
      firstName: 'Mimi',
      lastName: 'Nickname',
      email: 'contact-typed-by-lender@example.com',
      phoneNumber: '+33612345678',
      userId: BORROWER_USER_ID,
      statistics: {
        totalLoans: 3,
        returnedOnTime: 1,
        returnedLate: 1,
        notReturned: 1,
        averageReturnDelay: 4,
        trustScore: 42,
      },
    });
  });

  it('gives the borrower their own account profile, without phoneNumber nor statistics', () => {
    const res = toLoanResponse(buildLoan(), BORROWER_USER_ID);

    expect(res.borrower).toEqual({
      id: BORROWER_ID,
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie@example.com',
      userId: BORROWER_USER_ID,
    });
    expect(res.borrower).not.toHaveProperty('statistics');
    expect(res.borrower).not.toHaveProperty('phoneNumber');
  });

  it('does not leak the contact data typed by the lender into the borrower view', () => {
    const json = JSON.stringify(toLoanResponse(buildLoan(), BORROWER_USER_ID));

    expect(json).not.toContain('Mimi');
    expect(json).not.toContain('contact-typed-by-lender');
    expect(json).not.toContain('+33612345678');
    expect(json).not.toContain('trustScore');
  });

  it.each([null, 'absent' as const])(
    'falls back to a safe minimal profile when the borrower account is missing (%s)',
    (user) => {
      const res = toLoanResponse(buildLoan(user), BORROWER_USER_ID);

      expect(res.borrower).toEqual({
        id: BORROWER_ID,
        firstName: '',
        lastName: '',
        email: '',
        userId: BORROWER_USER_ID,
      });
    },
  );

  it('never gives the lender view to a caller who is not the lender', () => {
    const res = toLoanResponse(buildLoan(), OTHER_USER_ID);

    expect(res.borrower).not.toHaveProperty('statistics');
    expect(res.borrower).not.toHaveProperty('phoneNumber');
  });
});

describe('toLoanResponse — lender of a deleted account (FIX-22)', () => {
  it('omits accountDeleted for an active account', () => {
    const res = toLoanResponse(buildLoan(), BORROWER_USER_ID);

    expect(res.lender).not.toHaveProperty('accountDeleted');
  });

  it('flags a tombstone lender with accountDeleted: true and its stored fixed names', () => {
    const loan = buildLoan();
    loan.lender = {
      ...LENDER,
      firstName: 'Compte',
      lastName: 'supprimé',
      email: `deleted+${LENDER_USER_ID}@deleted.invalid`,
      deletedAt: NOW,
    };

    const res = toLoanResponse(loan, BORROWER_USER_ID);

    expect(res.lender).toEqual({
      id: LENDER_USER_ID,
      firstName: 'Compte',
      lastName: 'supprimé',
      profilePicture: null,
      accountDeleted: true,
    });
  });
});
