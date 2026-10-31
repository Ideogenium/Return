import type { LoanStatus, ItemCategory } from '@prisma/client';
import type { PhotoResponse } from '../../items/interfaces/photo-response.interface.js';
import type { BorrowerStatistics } from '../../borrowers/interfaces/borrower-response.interface.js';

export interface LoanItemResponse {
  id: string;
  name: string;
  description: string | null;
  category: ItemCategory;
  estimatedValue: number | null;
  photos: PhotoResponse[];
  createdAt: string;
}

export interface LoanLenderResponse {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
}

/** Lender view: the contact as the lender saved it, with the private statistics. */
export interface LoanBorrowerResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  userId: string | null;
  /** Omitted (not null) unless the caller is the lender of the loan. */
  statistics?: BorrowerStatistics;
}

export interface LoanResponse {
  id: string;
  item: LoanItemResponse;
  lender: LoanLenderResponse;
  borrower: LoanBorrowerResponse;
  returnDate: string | null;
  status: LoanStatus;
  confirmationDate: string | null;
  returnedDate: string | null;
  notes: string | null;
  contestReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLoansResponse {
  data: LoanResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
