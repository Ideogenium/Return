import { http, HttpResponse } from 'msw';

// All MSW handlers use the same base URL for tests (real API prefix)
const API_REAL = 'http://localhost:3000/v1';

// --- Données mock réutilisables ---

const mockUser = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'LENDER' as const,
  profilePicture: null,
  createdAt: '2026-02-01T10:00:00Z',
  lastLoginAt: '2026-02-18T08:00:00Z',
};

const mockBorrower = {
  id: '5d6e7f8a-1b2c-4d3e-a5f6-7a8b9c0d1e2f',
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie.dupont@example.com',
  phoneNumber: '+33612345678',
  userId: null,
  statistics: {
    totalLoans: 5,
    returnedOnTime: 3,
    returnedLate: 1,
    notReturned: 1,
    averageReturnDelay: 2,
    trustScore: 75,
  },
};

const mockBorrowerStats = {
  totalLoans: 5,
  returnedOnTime: 3,
  returnedLate: 1,
  notReturned: 1,
  averageReturnDelay: 2,
  trustScore: 75,
};

const mockPhoto = {
  id: 'p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
  url: 'https://storage.return.app/items/photo1.jpg',
  thumbnailUrl: 'https://storage.return.app/items/photo1_thumb.jpg',
  uploadedAt: '2026-02-20T14:00:00Z',
};

const mockItem = {
  id: '9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  name: 'Perceuse Bosch',
  description: 'Perceuse visseuse sans fil 18V',
  category: 'TOOLS' as const,
  estimatedValue: 89.99,
  photos: [{ ...mockPhoto }],
  createdAt: '2026-02-10T10:00:00Z',
};

const mockLoan = {
  id: '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d',
  item: { ...mockItem },
  lender: {
    id: mockUser.id,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    profilePicture: null,
  },
  borrower: { ...mockBorrower },
  status: 'ACTIVE' as const,
  returnDate: '2026-04-15',
  confirmationDate: '2026-02-02T10:00:00Z',
  returnedDate: null,
  notes: 'Avec 2 batteries et chargeur',
  contestReason: null,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-02T10:00:00Z',
};

const mockSettings = {
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr' as const,
  timezone: 'Europe/Paris',
};

const mockSenderUser = {
  id: 'sender-user-id-1234',
  firstName: 'Alice',
  lastName: 'Martin',
};

const mockRecipientUser = {
  id: 'recipient-user-id-5678',
  firstName: 'Bob',
  lastName: 'Durand',
};

const mockInvitation = {
  id: 'inv-received-1234',
  status: 'PENDING' as const,
  senderUser: { ...mockSenderUser },
  recipientEmail: 'test@example.com',
  recipientUser: { id: mockUser.id, firstName: mockUser.firstName, lastName: mockUser.lastName },
  createdAt: '2026-03-01T10:00:00Z',
  expiresAt: '2026-03-15T10:00:00Z',
  acceptedAt: null,
  rejectedAt: null,
};

const mockSentInvitation = {
  id: 'inv-sent-5678',
  status: 'PENDING' as const,
  senderUser: { id: mockUser.id, firstName: mockUser.firstName, lastName: mockUser.lastName },
  recipientEmail: 'bob.durand@example.com',
  recipientUser: { ...mockRecipientUser },
  createdAt: '2026-03-02T10:00:00Z',
  expiresAt: '2026-03-16T10:00:00Z',
  acceptedAt: null,
  rejectedAt: null,
};

const mockSearchResult = {
  id: 'search-user-id-9999',
  firstName: 'Charlie',
  lastName: 'Lemoine',
  email: 'charlie.lemoine@example.com',
  alreadyContact: false,
  pendingInvitation: false,
  pendingInvitationId: null,
};

const mockNotificationUnread = {
  id: 'notif-unread-1234',
  type: 'LOAN_CREATED' as const,
  title: 'Nouveau prêt',
  body: 'Marie Dupont vous a envoyé un prêt',
  isRead: false,
  relatedLoanId: '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d',
  createdAt: '2026-03-18T10:00:00Z',
};

const mockNotificationRead = {
  id: 'notif-read-5678',
  type: 'LOAN_CONFIRMED' as const,
  title: 'Prêt confirmé',
  body: 'Votre prêt a été confirmé par Marie Dupont',
  isRead: true,
  relatedLoanId: '7f3c9a2b-4d1e-4a8f-9c7b-1e3f5a6b8c9d',
  createdAt: '2026-03-17T08:00:00Z',
};

export const handlers = [
  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  // POST /auth/login
  http.post(`${API_REAL}/auth/login`, () => {
    return HttpResponse.json(
      {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        user: { ...mockUser },
      },
      { status: 200 },
    );
  }),

  // POST /auth/register
  http.post(`${API_REAL}/auth/register`, () => {
    return HttpResponse.json(
      {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        user: {
          ...mockUser,
          id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
          email: 'new@example.com',
          firstName: 'Jane',
          createdAt: '2026-02-16T10:00:00Z',
          lastLoginAt: null,
        },
      },
      { status: 201 },
    );
  }),

  // POST /auth/refresh
  http.post(`${API_REAL}/auth/refresh`, () => {
    return HttpResponse.json(
      {
        accessToken: 'mock-new-access-token',
        refreshToken: 'mock-new-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        user: { ...mockUser },
      },
      { status: 200 },
    );
  }),

  // POST /auth/logout
  http.post(`${API_REAL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // =========================================================================
  // USERS — Profil
  // =========================================================================

  // GET /users/me
  http.get(`${API_REAL}/users/me`, () => {
    return HttpResponse.json({ ...mockUser, settings: { ...mockSettings } }, { status: 200 });
  }),

  // PATCH /users/me
  http.patch(`${API_REAL}/users/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockUser, ...body }, { status: 200 });
  }),

  // DELETE /users/me
  http.delete(`${API_REAL}/users/me`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /users/me/avatar
  http.put(`${API_REAL}/users/me/avatar`, () => {
    return HttpResponse.json(
      { ...mockUser, profilePicture: 'https://storage.return.app/users/avatar.jpg' },
      { status: 200 },
    );
  }),

  // =========================================================================
  // USERS — Mot de passe
  // =========================================================================

  // PATCH /users/me/password
  http.patch(`${API_REAL}/users/me/password`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // =========================================================================
  // USERS — Settings
  // =========================================================================

  // GET /users/me/settings
  http.get(`${API_REAL}/users/me/settings`, () => {
    return HttpResponse.json({ ...mockSettings }, { status: 200 });
  }),

  // GET /users/me/trust-score
  http.get('*/users/me/trust-score', () =>
    HttpResponse.json({
      trustScore: 87,
      totalLoans: 40,
      returnedOnTime: 31,
      returnedLate: 8,
      notReturned: 3,
    }),
  ),

  // PATCH /users/me/settings
  http.patch(`${API_REAL}/users/me/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockSettings, ...body }, { status: 200 });
  }),

  // =========================================================================
  // BORROWERS
  // =========================================================================

  // GET /borrowers
  http.get(`${API_REAL}/borrowers`, () => {
    return HttpResponse.json(
      {
        data: [{ ...mockBorrower }],
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // POST /borrowers
  http.post(`${API_REAL}/borrowers`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...mockBorrower,
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        ...body,
      },
      { status: 201 },
    );
  }),

  // GET /borrowers/:id
  http.get(`${API_REAL}/borrowers/:id`, ({ params }) => {
    if (params.id === 'not-found') {
      return HttpResponse.json(
        {
          type: 'https://api.return.app/errors/borrower-not-found',
          title: 'Borrower Not Found',
          status: 404,
          detail: `The borrower with ID '${params.id}' does not exist.`,
          instance: `/v1/borrowers/${params.id}`,
          timestamp: new Date().toISOString(),
          requestId: 'req-mock',
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({ ...mockBorrower, id: params.id }, { status: 200 });
  }),

  // PATCH /borrowers/:id
  http.patch(`${API_REAL}/borrowers/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockBorrower, id: params.id, ...body }, { status: 200 });
  }),

  // DELETE /borrowers/:id
  http.delete(`${API_REAL}/borrowers/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /borrowers/:id/statistics
  http.get(`${API_REAL}/borrowers/:id/statistics`, () => {
    return HttpResponse.json({ ...mockBorrowerStats }, { status: 200 });
  }),

  // GET /borrowers/:id/loans
  http.get(`${API_REAL}/borrowers/:id/loans`, () => {
    return HttpResponse.json([], { status: 200 });
  }),

  // =========================================================================
  // ITEMS
  // =========================================================================

  // GET /items
  http.get(`${API_REAL}/items`, () => {
    return HttpResponse.json(
      {
        data: [{ ...mockItem }],
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // POST /items
  http.post(`${API_REAL}/items`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...mockItem,
        id: 'new-item-id-1234',
        photos: [],
        ...body,
      },
      { status: 201 },
    );
  }),

  // GET /items/:itemId
  http.get(`${API_REAL}/items/:itemId`, ({ params }) => {
    if (params.itemId === 'not-found') {
      return HttpResponse.json(
        {
          type: 'https://api.return.app/errors/item-not-found',
          title: 'Item Not Found',
          status: 404,
          detail: `The item with ID '${params.itemId}' does not exist.`,
          instance: `/v1/items/${params.itemId}`,
          timestamp: new Date().toISOString(),
          requestId: 'req-mock',
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({ ...mockItem, id: params.itemId }, { status: 200 });
  }),

  // PATCH /items/:itemId
  http.patch(`${API_REAL}/items/:itemId`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockItem, id: params.itemId, ...body }, { status: 200 });
  }),

  // DELETE /items/:itemId
  http.delete(`${API_REAL}/items/:itemId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /items/:itemId/photos
  http.post(`${API_REAL}/items/:itemId/photos`, () => {
    return HttpResponse.json(
      {
        id: 'p-new-photo-id',
        url: 'https://storage.return.app/items/new-photo.jpg',
        thumbnailUrl: 'https://storage.return.app/items/new-photo_thumb.jpg',
        uploadedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // DELETE /items/:itemId/photos/:photoId
  http.delete(`${API_REAL}/items/:itemId/photos/:photoId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // =========================================================================
  // LOANS
  // =========================================================================

  // GET /loans
  http.get(`${API_REAL}/loans`, ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    if (role === 'borrower') {
      return HttpResponse.json(
        {
          data: [
            {
              ...mockLoan,
              id: 'borrower-loan-1',
              status: 'RETURNED' as const,
              returnDate: '2026-03-15',
              returnedDate: '2026-03-14T10:00:00Z',
            },
          ],
          pagination: {
            currentPage: 1,
            itemsPerPage: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
        { status: 200 },
      );
    }

    return HttpResponse.json(
      {
        data: [{ ...mockLoan }],
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // POST /loans
  http.post(`${API_REAL}/loans`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...mockLoan,
        id: 'new-loan-id-1234',
        status: 'PENDING_CONFIRMATION',
        confirmationDate: null,
        notes: (body.notes as string) ?? null,
        returnDate: (body.returnDate as string) ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // GET /loans/:id
  http.get(`${API_REAL}/loans/:id`, ({ params }) => {
    if (params.id === 'not-found') {
      return HttpResponse.json(
        {
          type: 'https://api.return.app/errors/loan-not-found',
          title: 'Loan Not Found',
          status: 404,
          detail: `The loan with ID '${params.id}' does not exist.`,
          instance: `/v1/loans/${params.id}`,
          timestamp: new Date().toISOString(),
          requestId: 'req-mock',
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({ ...mockLoan, id: params.id }, { status: 200 });
  }),

  // PATCH /loans/:id
  http.patch(`${API_REAL}/loans/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { ...mockLoan, id: params.id, ...body, updatedAt: new Date().toISOString() },
      { status: 200 },
    );
  }),

  // DELETE /loans/:id
  http.delete(`${API_REAL}/loans/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /loans/:id/status
  http.patch(`${API_REAL}/loans/:id/status`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const status = typeof body.status === 'string' ? body.status : mockLoan.status;
    return HttpResponse.json(
      {
        ...mockLoan,
        id: params.id,
        status,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),

  // POST /loans/:id/confirm
  http.post(`${API_REAL}/loans/:id/confirm`, ({ params }) => {
    return HttpResponse.json(
      {
        ...mockLoan,
        id: params.id,
        status: 'ACTIVE',
        confirmationDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),

  // POST /loans/:id/contest
  http.post(`${API_REAL}/loans/:id/contest`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...mockLoan,
        id: params.id,
        status: 'CONTESTED',
        contestReason: body.reason,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),

  // =========================================================================
  // CONTACT INVITATIONS
  // =========================================================================

  // POST /contact-invitations/search
  http.post(`${API_REAL}/contact-invitations/search`, () => {
    return HttpResponse.json(
      {
        data: [{ ...mockSearchResult }],
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // POST /contact-invitations
  http.post(`${API_REAL}/contact-invitations`, () => {
    return HttpResponse.json(
      {
        ...mockSentInvitation,
        id: 'inv-new-1234',
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // GET /contact-invitations
  http.get(`${API_REAL}/contact-invitations`, ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction');

    if (direction === 'sent') {
      return HttpResponse.json(
        {
          data: [{ ...mockSentInvitation }],
          pagination: {
            currentPage: 1,
            itemsPerPage: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
        { status: 200 },
      );
    }

    return HttpResponse.json(
      {
        data: [{ ...mockInvitation }],
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // POST /contact-invitations/:invitationId/accept
  http.post(`${API_REAL}/contact-invitations/:invitationId/accept`, ({ params }) => {
    return HttpResponse.json(
      {
        ...mockInvitation,
        id: params.invitationId,
        status: 'ACCEPTED',
        acceptedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),

  // POST /contact-invitations/:invitationId/reject
  http.post(`${API_REAL}/contact-invitations/:invitationId/reject`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /contact-invitations/:invitationId
  http.delete(`${API_REAL}/contact-invitations/:invitationId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // =========================================================================
  // HISTORY / STATISTICS
  // =========================================================================

  // GET /history/statistics
  http.get(`${API_REAL}/history/statistics`, () => {
    return HttpResponse.json(
      {
        overview: {
          totalLoans: 3,
          activeLoans: 1,
          returnedLoans: 2,
          notReturnedLoans: 0,
          contestedLoans: 0,
          overdueLoans: 0,
          averageReturnDelay: 1.5,
        },
        byCategory: [],
        topBorrowers: [],
        mostLoanedItems: [],
      },
      { status: 200 },
    );
  }),

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  // GET /notifications
  http.get(`${API_REAL}/notifications`, ({ request }) => {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly');

    const notifications =
      unreadOnly === 'true'
        ? [{ ...mockNotificationUnread }]
        : [{ ...mockNotificationUnread }, { ...mockNotificationRead }];

    return HttpResponse.json(
      {
        data: notifications,
        pagination: {
          currentPage: 1,
          itemsPerPage: 20,
          totalItems: notifications.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      { status: 200 },
    );
  }),

  // PATCH /notifications/:id/read
  http.patch(`${API_REAL}/notifications/:id/read`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /notifications/read-all
  http.post(`${API_REAL}/notifications/read-all`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /notifications/device-token
  http.post(`${API_REAL}/notifications/device-token`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /notifications/device-token
  http.delete(`${API_REAL}/notifications/device-token`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
