import type { Loan, Item, Photo, User, Borrower } from '@prisma/client';
import type {
  LoanResponse,
  LoanItemResponse,
  LoanLenderResponse,
  LoanBorrowerResponse,
} from '../../loans/interfaces/loan-response.interface.js';
import type { PhotoResponse } from '../../items/interfaces/photo-response.interface.js';

// =============================================================================
// Shared Loan-Response Mappers
// =============================================================================
// Centralises the Prisma-to-response transformation logic used by both
// LoansService and HistoryService, following the same pattern as user.mapper.ts.
// =============================================================================

export type LoanWithRelations = Loan & {
  item: Item & { photos: Photo[] };
  lender: User;
  // `user` is only loaded through LOAN_INCLUDE; it is the borrower's own account.
  borrower: Borrower & { user?: BorrowerAccountProfile | null };
};

type BorrowerAccountProfile = Pick<User, 'firstName' | 'lastName' | 'email'>;

/** Prisma include shared by every query whose result goes through toLoanResponse. */
export const LOAN_INCLUDE = {
  item: { include: { photos: true } },
  lender: true,
  // The borrower account is needed to build the borrower's own view of the loan.
  borrower: {
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  },
} as const;

export function toPhotoResponse(photo: Photo): PhotoResponse {
  return {
    id: photo.id,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    uploadedAt: photo.uploadedAt.toISOString(),
  };
}

export function toItemResponse(item: Item & { photos: Photo[] }): LoanItemResponse {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    estimatedValue: item.estimatedValue,
    photos: item.photos.map((p) => toPhotoResponse(p)),
    createdAt: item.createdAt.toISOString(),
  };
}

/**
 * A deleted lender (tombstone, FIX-22) already stores the fixed names and no picture;
 * `accountDeleted` lets the app show a translated label instead.
 */
export function toLenderResponse(user: User): LoanLenderResponse {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePicture: user.profilePicture,
    ...(user.deletedAt ? { accountDeleted: true as const } : {}),
  };
}

/** Lender view: the contact as saved by the lender, including its private statistics. */
export function toBorrowerResponse(borrower: Borrower): LoanBorrowerResponse {
  return {
    id: borrower.id,
    firstName: borrower.firstName,
    lastName: borrower.lastName,
    email: borrower.email,
    phoneNumber: borrower.phoneNumber,
    userId: borrower.userId,
    statistics: {
      totalLoans: borrower.totalLoans,
      returnedOnTime: borrower.returnedOnTime,
      returnedLate: borrower.returnedLate,
      notReturned: borrower.notReturned,
      averageReturnDelay: borrower.averageReturnDelay,
      trustScore: borrower.trustScore,
    },
  };
}

/**
 * Borrower view: the borrower's own account profile. The name, phone number and statistics
 * stored on the contact belong to the lender and must not be exposed to the borrower.
 */
export function toBorrowerSelfResponse(
  borrower: LoanWithRelations['borrower'],
): LoanBorrowerResponse {
  // A borrower caller always has a linked account; if it is missing anyway, return empty
  // strings rather than falling back to the lender's contact data.
  return {
    id: borrower.id,
    firstName: borrower.user?.firstName ?? '',
    lastName: borrower.user?.lastName ?? '',
    email: borrower.user?.email ?? '',
    userId: borrower.userId,
  };
}

/**
 * The response depends on the caller: only the lender gets the contact and its statistics.
 * Any other caller gets the borrower view, so the lender view is never granted by default.
 */
export function toLoanResponse(loan: LoanWithRelations, viewerUserId: string): LoanResponse {
  const isLender = viewerUserId === loan.lenderId;
  return {
    id: loan.id,
    item: toItemResponse(loan.item),
    lender: toLenderResponse(loan.lender),
    borrower: isLender ? toBorrowerResponse(loan.borrower) : toBorrowerSelfResponse(loan.borrower),
    returnDate: loan.returnDate ? loan.returnDate.toISOString().slice(0, 10) : null,
    status: loan.status,
    confirmationDate: loan.confirmationDate?.toISOString() ?? null,
    returnedDate: loan.returnedDate?.toISOString() ?? null,
    notes: loan.notes,
    contestReason: loan.contestReason,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}
