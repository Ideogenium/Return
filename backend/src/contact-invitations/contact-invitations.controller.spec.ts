import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ContactInvitationsController } from './contact-invitations.controller.js';
import { ContactInvitationsService } from './contact-invitations.service.js';
import type {
  ContactInvitationResponse,
  PaginatedContactInvitationsResponse,
  PaginatedUserSearchResultsResponse,
} from './interfaces/contact-invitation-response.interface.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

// =============================================================================
// Fixtures
// =============================================================================

const SENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const INVITATION_ID = '880e8400-e29b-41d4-a716-446655440000';

const MOCK_AUTH_USER: AuthenticatedUser = {
  userId: SENDER_USER_ID,
  email: 'jean.martin@example.com',
  role: 'LENDER',
  jti: 'jti-123',
  tokenExp: Math.floor(Date.now() / 1000) + 900,
};

const MOCK_INVITATION_RESPONSE: ContactInvitationResponse = {
  id: INVITATION_ID,
  status: 'PENDING',
  senderUser: { id: SENDER_USER_ID, firstName: 'Jean', lastName: 'Martin' },
  recipientEmail: 'marie.dupont@example.com',
  recipientUser: {
    id: '660e8400-e29b-41d4-a716-446655440000',
    firstName: 'Marie',
    lastName: 'Dupont',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  expiresAt: '2025-01-31T00:00:00.000Z',
  acceptedAt: null,
  rejectedAt: null,
};

const MOCK_PAGINATED_INVITATIONS: PaginatedContactInvitationsResponse = {
  data: [MOCK_INVITATION_RESPONSE],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const MOCK_SEARCH_RESULTS: PaginatedUserSearchResultsResponse = {
  data: [
    {
      id: '660e8400-e29b-41d4-a716-446655440000',
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie.dupont@example.com',
      alreadyContact: false,
      pendingInvitation: false,
      pendingInvitationId: null,
    },
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

// =============================================================================
// Test Suite
// =============================================================================

describe('ContactInvitationsController', () => {
  let controller: ContactInvitationsController;
  let service: DeepMockProxy<ContactInvitationsService>;

  beforeEach(async () => {
    service = mockDeep<ContactInvitationsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactInvitationsController],
      providers: [{ provide: ContactInvitationsService, useValue: service }],
    }).compile();

    controller = module.get<ContactInvitationsController>(ContactInvitationsController);
  });

  // ===========================================================================
  // POST /v1/contact-invitations/search
  // ===========================================================================

  describe('searchUsers', () => {
    it('should delegate to service.searchUsers and return results', async () => {
      service.searchUsers.mockResolvedValue(MOCK_SEARCH_RESULTS);

      const result = await controller.searchUsers({ user: MOCK_AUTH_USER }, { query: 'marie' });

      expect(service.searchUsers).toHaveBeenCalledWith(SENDER_USER_ID, {
        query: 'marie',
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
    });
  });

  // ===========================================================================
  // POST /v1/contact-invitations
  // ===========================================================================

  describe('sendInvitation', () => {
    it('should create invitation, set Location header, and return 201', async () => {
      service.sendInvitation.mockResolvedValue(MOCK_INVITATION_RESPONSE);

      const mockRes = { setHeader: jest.fn() };
      const mockReq = {
        user: MOCK_AUTH_USER,
        protocol: 'http',
        headers: { host: 'localhost:3000' },
      };

      const result = await controller.sendInvitation(
        mockReq as never,
        { recipientEmail: 'marie.dupont@example.com' },
        mockRes as never,
      );

      expect(service.sendInvitation).toHaveBeenCalledWith(SENDER_USER_ID, {
        recipientEmail: 'marie.dupont@example.com',
      });
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Location',
        `http://localhost:3000/v1/contact-invitations/${INVITATION_ID}`,
      );
      expect(result.id).toBe(INVITATION_ID);
    });
  });

  // ===========================================================================
  // GET /v1/contact-invitations
  // ===========================================================================

  describe('listInvitations', () => {
    it('should list received invitations by default', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      const result = await controller.listInvitations({ user: MOCK_AUTH_USER }, {});

      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'received',
        status: undefined,
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
    });

    it('should pass direction=sent when provided', async () => {
      service.listInvitations.mockResolvedValue(MOCK_PAGINATED_INVITATIONS);

      await controller.listInvitations({ user: MOCK_AUTH_USER }, { direction: 'sent' });

      expect(service.listInvitations).toHaveBeenCalledWith(SENDER_USER_ID, {
        direction: 'sent',
        status: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  // ===========================================================================
  // POST /v1/contact-invitations/:invitationId/accept
  // ===========================================================================

  describe('acceptInvitation', () => {
    it('should delegate to service.acceptInvitation', async () => {
      const acceptedResponse = { ...MOCK_INVITATION_RESPONSE, status: 'ACCEPTED' };
      service.acceptInvitation.mockResolvedValue(acceptedResponse);

      const result = await controller.acceptInvitation({ user: MOCK_AUTH_USER }, INVITATION_ID);

      expect(service.acceptInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
      expect(result.status).toBe('ACCEPTED');
    });
  });

  // ===========================================================================
  // POST /v1/contact-invitations/:invitationId/reject
  // ===========================================================================

  describe('rejectInvitation', () => {
    it('should delegate to service.rejectInvitation (204 No Content)', async () => {
      service.rejectInvitation.mockResolvedValue(undefined);

      await controller.rejectInvitation({ user: MOCK_AUTH_USER }, INVITATION_ID);

      expect(service.rejectInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
    });
  });

  // ===========================================================================
  // DELETE /v1/contact-invitations/:invitationId
  // ===========================================================================

  describe('cancelInvitation', () => {
    it('should delegate to service.cancelInvitation (204 No Content)', async () => {
      service.cancelInvitation.mockResolvedValue(undefined);

      await controller.cancelInvitation({ user: MOCK_AUTH_USER }, INVITATION_ID);

      expect(service.cancelInvitation).toHaveBeenCalledWith(INVITATION_ID, SENDER_USER_ID);
    });
  });
});
