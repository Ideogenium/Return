// =============================================================================
// Borrower Response Interfaces — aligned with OpenAPI Borrower schema
// =============================================================================

export interface BorrowerStatistics {
  totalLoans: number;
  returnedOnTime: number;
  returnedLate: number;
  notReturned: number;
  /** Délai moyen de retour en jours (arrondi, conforme OpenAPI integer). null si aucun prêt rendu. */
  averageReturnDelay: number | null;
  /** null = pas encore noté (aucun prêt résolu). */
  trustScore: number | null;
}

export interface BorrowerResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  userId: string | null;
  statistics: BorrowerStatistics;
}

export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedBorrowersResponse {
  data: BorrowerResponse[];
  pagination: PaginationMetadata;
}

/**
 * Default statistics for a newly created borrower (no loans yet).
 */
export const DEFAULT_BORROWER_STATISTICS: BorrowerStatistics = {
  totalLoans: 0,
  returnedOnTime: 0,
  returnedLate: 0,
  notReturned: 0,
  averageReturnDelay: null,
  trustScore: null,
};
