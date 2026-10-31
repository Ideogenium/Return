import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContactInvitationsService } from './contact-invitations.service.js';
import { CONTACT_INVITATION_EVENTS } from '../common/events/contact-invitation.events.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';
import { InvitationStatus, type ContactInvitation, type User, type Borrower } from '@prisma/client';

// =============================================================================
// Fixtures
// =============================================================================

const SENDER_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECIPIENT_USER_ID = '660e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const INVITATION_ID = '880e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '990e8400-e29b-41d4-a716-446655440000';

const SENDER_USER: User = {
  id: SENDER_USER_ID,
  email: 'jean.martin@example.com',
  password: '$2b$12$hashedpassword',
  firstName: 'Jean',
  lastName: 'Martin',
  role: 'LENDER',
  profilePicture: null,
  phone: null,
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  lastLoginAt: null,
};

const RECIPIENT_USER: User = {
  id: RECIPIENT_USER_ID,
  email: 'marie.dupont@example.com',
  password: '$2b$12$hashedpassword',
  firstName: 'Marie',
  lastName: 'Dupont',
  role: 'LENDER',
  profilePicture: null,
  phone: null,
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  lastLoginAt: null,
};

const MOCK_INVITATION: ContactInvitation = {
  id: INVITATION_ID,
  senderUserId: SENDER_USER_ID,
  recipientEmail: 'marie.dupont@example.com',
  recipientUserId: RECIPIENT_USER_ID,
  status: InvitationStatus.PENDING,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  expiresAt: new Date('2025-01-31T00:00:00Z'),
  acceptedAt: null,
  rejectedAt: null,
};

// =============================================================================
// Test Suite
// =============================================================================

describe('ContactInvitationsService', () => {
  let service: ContactInvitationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ContactInvitationsService>(ContactInvitationsService);
  });

  // ===========================================================================
  // SEARCH USERS (CINV-003 / CINV-004)
  // ===========================================================================

  describe('searchUsers', () => {
    it('should return users matching the query by email', async () => {
      prisma.user.findMany.mockResolvedValue([RECIPIENT_USER]);
      prisma.user.count.mockResolvedValue(1);
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.borrower.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'marie.dupont@example.com',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('marie.dupont@example.com');
      expect(result.data[0].alreadyContact).toBe(false);
      expect(result.data[0].pendingInvitation).toBe(false);
      expect(result.data[0].pendingInvitationId).toBeNull();
    });

    it('should exclude the current user from results', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.borrower.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'jean',
        page: 1,
        limit: 20,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: SENDER_USER_ID },
          }),
        }),
      );
      expect(result.data).toHaveLength(0);
    });

    it('should indicate when a user is already a contact (Borrower exists)', async () => {
      prisma.user.findMany.mockResolvedValue([RECIPIENT_USER]);
      prisma.user.count.mockResolvedValue(1);
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      // Borrower exists → alreadyContact = true
      prisma.borrower.findMany.mockResolvedValue([{ userId: RECIPIENT_USER_ID } as any]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'marie',
        page: 1,
        limit: 20,
      });

      expect(result.data[0].alreadyContact).toBe(true);
      expect(result.data[0].pendingInvitation).toBe(false);
    });

    it('should show alreadyContact=false when Borrower was deleted (invitation still ACCEPTED)', async () => {
      prisma.user.findMany.mockResolvedValue([RECIPIENT_USER]);
      prisma.user.count.mockResolvedValue(1);
      // Invitation exists as ACCEPTED (historical) — but no Borrower in the list
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.borrower.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'marie',
        page: 1,
        limit: 20,
      });

      // Borrower was deleted → alreadyContact must be false, not based on invitation history
      expect(result.data[0].alreadyContact).toBe(false);
    });

    it('should indicate when a pending invitation exists and include its ID', async () => {
      prisma.user.findMany.mockResolvedValue([RECIPIENT_USER]);
      prisma.user.count.mockResolvedValue(1);
      prisma.contactInvitation.findMany.mockResolvedValue([MOCK_INVITATION]);
      prisma.borrower.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'marie',
        page: 1,
        limit: 20,
      });

      expect(result.data[0].pendingInvitation).toBe(true);
      expect(result.data[0].pendingInvitationId).toBe(INVITATION_ID);
      expect(result.data[0].alreadyContact).toBe(false);
    });

    it('should return paginated results', async () => {
      prisma.user.findMany.mockResolvedValue([RECIPIENT_USER]);
      prisma.user.count.mockResolvedValue(25);
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.borrower.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(SENDER_USER_ID, {
        query: 'dupont',
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 3,
        totalItems: 25,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  // ===========================================================================
  // SEND INVITATION (CINV-005 / CINV-006)
  // ===========================================================================

  describe('sendInvitation', () => {
    it('should create a PENDING invitation for a registered user', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(null);
      prisma.contactInvitation.create.mockResolvedValue({
        ...MOCK_INVITATION,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      } as any);

      const result = await service.sendInvitation(SENDER_USER_ID, {
        recipientEmail: 'marie.dupont@example.com',
      });

      expect(result.status).toBe('PENDING');
      expect(prisma.contactInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderUserId: SENDER_USER_ID,
            recipientEmail: 'marie.dupont@example.com',
            recipientUserId: RECIPIENT_USER_ID,
            status: InvitationStatus.PENDING,
          }),
        }),
      );
    });

    it('should emit SENT after the invitation is created', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(null);
      prisma.contactInvitation.create.mockResolvedValue({
        ...MOCK_INVITATION,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      } as any);

      await service.sendInvitation(SENDER_USER_ID, { recipientEmail: 'marie.dupont@example.com' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(CONTACT_INVITATION_EVENTS.SENT, {
        invitationId: INVITATION_ID,
        senderUserId: SENDER_USER_ID,
        recipientUserId: RECIPIENT_USER_ID,
        senderFirstName: 'Jean',
        senderLastName: 'Martin',
      });
    });

    it('should not emit SENT when the creation fails', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(null);
      prisma.contactInvitation.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.sendInvitation(SENDER_USER_ID, { recipientEmail: 'marie.dupont@example.com' }),
      ).rejects.toThrow('db down');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not emit SENT when an invitation is already pending', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(MOCK_INVITATION as any);

      await expect(
        service.sendInvitation(SENDER_USER_ID, { recipientEmail: 'marie.dupont@example.com' }),
      ).rejects.toBeDefined();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw 400 for self-invitation', async () => {
      prisma.user.findFirst.mockResolvedValue(SENDER_USER);

      try {
        await service.sendInvitation(SENDER_USER_ID, {
          recipientEmail: 'jean.martin@example.com',
        });
        fail('Expected BadRequestException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.BAD_REQUEST);
        expect(body.type).toContain('self-invitation');
      }
    });

    it('should throw 404 when recipient is not registered', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      try {
        await service.sendInvitation(SENDER_USER_ID, {
          recipientEmail: 'unknown@example.com',
        });
        fail('Expected NotFoundException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
        expect(body.type).toContain('user-not-found');
      }
    });

    it('should throw 409 when a PENDING invitation already exists', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(MOCK_INVITATION);

      try {
        await service.sendInvitation(SENDER_USER_ID, {
          recipientEmail: 'marie.dupont@example.com',
        });
        fail('Expected ConflictException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toContain('invitation-already-sent');
      }
    });

    it('should set expiration to 30 days from creation', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      prisma.contactInvitation.findFirst.mockResolvedValue(null);
      prisma.contactInvitation.create.mockResolvedValue({
        ...MOCK_INVITATION,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      } as any);

      await service.sendInvitation(SENDER_USER_ID, {
        recipientEmail: 'marie.dupont@example.com',
      });

      const createCall = prisma.contactInvitation.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const createdAt = new Date();
      // Should be approximately 30 days in the future (within 5 seconds tolerance)
      const diffDays = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29.9);
      expect(diffDays).toBeLessThan(30.1);
    });

    it('should allow re-invitation after rejection (partial unique index)', async () => {
      prisma.user.findFirst.mockResolvedValue(RECIPIENT_USER);
      // findFirst returns null → no PENDING invitation exists
      // (the previous one was REJECTED, so the partial unique index allows a new one)
      prisma.contactInvitation.findFirst.mockResolvedValue(null);
      prisma.contactInvitation.create.mockResolvedValue({
        ...MOCK_INVITATION,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      } as any);

      const result = await service.sendInvitation(SENDER_USER_ID, {
        recipientEmail: 'marie.dupont@example.com',
      });

      expect(result.id).toBe(MOCK_INVITATION.id);
      expect(prisma.contactInvitation.create).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ACCEPT INVITATION (CINV-007 / CINV-008)
  // ===========================================================================

  describe('acceptInvitation', () => {
    it('should accept a PENDING invitation and create a Borrower with userId set', async () => {
      const invitationWithRelations = {
        ...MOCK_INVITATION,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      };

      prisma.contactInvitation.findUnique.mockResolvedValue(invitationWithRelations as any);

      // Mock the transaction
      const txMock = mockDeep<any>();
      txMock.contactInvitation.update.mockResolvedValue({
        ...invitationWithRelations,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });
      txMock.borrower.upsert.mockResolvedValue({
        id: BORROWER_ID,
        firstName: 'Marie',
        lastName: 'Dupont',
        email: 'marie.dupont@example.com',
        phoneNumber: null,
        userId: RECIPIENT_USER_ID,
        lenderUserId: SENDER_USER_ID,
        trustScore: 0,
        totalLoans: 0,
        returnedOnTime: 0,
        returnedLate: 0,
        notReturned: 0,
        averageReturnDelay: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Borrower);

      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.acceptInvitation(INVITATION_ID, RECIPIENT_USER_ID);

      expect(result.status).toBe('ACCEPTED');

      // Verify TWO bidirectional Borrower upserts
      expect(txMock.borrower.upsert).toHaveBeenCalledTimes(2);

      // 1. Sender's contacts: recipient (Marie) added to Jean's list
      expect(txMock.borrower.upsert).toHaveBeenCalledWith({
        where: {
          lenderUserId_email: {
            lenderUserId: SENDER_USER_ID,
            email: 'marie.dupont@example.com',
          },
        },
        update: expect.objectContaining({
          userId: RECIPIENT_USER_ID,
        }),
        create: expect.objectContaining({
          userId: RECIPIENT_USER_ID,
          email: 'marie.dupont@example.com',
          lenderUserId: SENDER_USER_ID,
        }),
      });

      // 2. Recipient's contacts: sender (Jean) added to Marie's list
      expect(txMock.borrower.upsert).toHaveBeenCalledWith({
        where: {
          lenderUserId_email: {
            lenderUserId: RECIPIENT_USER_ID,
            email: 'jean.martin@example.com',
          },
        },
        update: expect.objectContaining({
          userId: SENDER_USER_ID,
        }),
        create: expect.objectContaining({
          userId: SENDER_USER_ID,
          email: 'jean.martin@example.com',
          lenderUserId: RECIPIENT_USER_ID,
        }),
      });

      // Verify ACCEPTED event emitted with borrowerId
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CONTACT_INVITATION_EVENTS.ACCEPTED,
        expect.objectContaining({
          invitationId: INVITATION_ID,
          senderUserId: SENDER_USER_ID,
          recipientUserId: RECIPIENT_USER_ID,
          borrowerId: BORROWER_ID,
        }),
      );
    });

    it('should throw 404 when invitation does not exist', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue(null);

      try {
        await service.acceptInvitation(INVITATION_ID, RECIPIENT_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
        expect(body.type).toContain('invitation-not-found');
      }
    });

    it('should throw 409 when invitation is not PENDING', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue({
        ...MOCK_INVITATION,
        status: InvitationStatus.ACCEPTED,
        senderUser: SENDER_USER,
        recipientUser: RECIPIENT_USER,
      } as any);

      try {
        await service.acceptInvitation(INVITATION_ID, RECIPIENT_USER_ID);
        fail('Expected ConflictException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toContain('invitation-not-pending');
      }
    });
  });

  // ===========================================================================
  // REJECT INVITATION (CINV-009 / CINV-010)
  // ===========================================================================

  describe('rejectInvitation', () => {
    it('should reject a PENDING invitation', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue(MOCK_INVITATION as any);
      prisma.contactInvitation.update.mockResolvedValue({
        ...MOCK_INVITATION,
        status: InvitationStatus.REJECTED,
        rejectedAt: new Date(),
      });

      await service.rejectInvitation(INVITATION_ID, RECIPIENT_USER_ID);

      expect(prisma.contactInvitation.update).toHaveBeenCalledWith({
        where: { id: INVITATION_ID },
        data: {
          status: InvitationStatus.REJECTED,
          rejectedAt: expect.any(Date),
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CONTACT_INVITATION_EVENTS.REJECTED,
        expect.objectContaining({
          invitationId: INVITATION_ID,
          senderUserId: SENDER_USER_ID,
          recipientUserId: RECIPIENT_USER_ID,
        }),
      );
    });

    it('should throw 404 when invitation does not exist', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue(null);

      try {
        await service.rejectInvitation(INVITATION_ID, RECIPIENT_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 409 when invitation is not PENDING', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue({
        ...MOCK_INVITATION,
        status: InvitationStatus.EXPIRED,
      } as any);

      try {
        await service.rejectInvitation(INVITATION_ID, RECIPIENT_USER_ID);
        fail('Expected ConflictException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toContain('invitation-not-pending');
      }
    });
  });

  // ===========================================================================
  // CANCEL INVITATION (DELETE)
  // ===========================================================================

  describe('cancelInvitation', () => {
    it('should cancel a PENDING invitation sent by the user', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue(MOCK_INVITATION as any);
      prisma.contactInvitation.delete.mockResolvedValue(MOCK_INVITATION);

      await service.cancelInvitation(INVITATION_ID, SENDER_USER_ID);

      expect(prisma.contactInvitation.delete).toHaveBeenCalledWith({
        where: { id: INVITATION_ID },
      });
    });

    it('should throw 404 when invitation does not exist', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue(null);

      try {
        await service.cancelInvitation(INVITATION_ID, SENDER_USER_ID);
        fail('Expected NotFoundException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should throw 409 when invitation is already ACCEPTED', async () => {
      prisma.contactInvitation.findUnique.mockResolvedValue({
        ...MOCK_INVITATION,
        status: InvitationStatus.ACCEPTED,
      } as any);

      try {
        await service.cancelInvitation(INVITATION_ID, SENDER_USER_ID);
        fail('Expected ConflictException');
      } catch (error) {
        const body = (error as { getResponse: () => ProblemDetails }).getResponse();
        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.type).toContain('invitation-already-accepted');
      }
    });
  });

  // ===========================================================================
  // LIST INVITATIONS (CINV-009 / CINV-010)
  // ===========================================================================

  describe('listInvitations', () => {
    const invitationWithRelations = {
      ...MOCK_INVITATION,
      senderUser: SENDER_USER,
      recipientUser: RECIPIENT_USER,
    };

    it('should list received invitations by default', async () => {
      prisma.contactInvitation.findMany.mockResolvedValue([invitationWithRelations] as any);
      prisma.contactInvitation.count.mockResolvedValue(1);

      const result = await service.listInvitations(RECIPIENT_USER_ID, {});

      expect(prisma.contactInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientUserId: RECIPIENT_USER_ID,
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should list sent invitations when direction=sent', async () => {
      prisma.contactInvitation.findMany.mockResolvedValue([invitationWithRelations] as any);
      prisma.contactInvitation.count.mockResolvedValue(1);

      const result = await service.listInvitations(SENDER_USER_ID, { direction: 'sent' });

      expect(prisma.contactInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            senderUserId: SENDER_USER_ID,
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.contactInvitation.count.mockResolvedValue(0);

      await service.listInvitations(RECIPIENT_USER_ID, {
        direction: 'received',
        status: 'PENDING',
      });

      expect(prisma.contactInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientUserId: RECIPIENT_USER_ID,
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should return paginated results', async () => {
      prisma.contactInvitation.findMany.mockResolvedValue([]);
      prisma.contactInvitation.count.mockResolvedValue(25);

      const result = await service.listInvitations(RECIPIENT_USER_ID, {
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 3,
        totalItems: 25,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  // ===========================================================================
  // HAS ACCEPTED CONTACT (for LoansService — CINV-019)
  // ===========================================================================

  describe('hasAcceptedContact', () => {
    it('should return true when lender sent the invitation (direct direction)', async () => {
      prisma.contactInvitation.findFirst.mockResolvedValue({
        ...MOCK_INVITATION,
        status: InvitationStatus.ACCEPTED,
      });

      const result = await service.hasAcceptedContact(SENDER_USER_ID, RECIPIENT_USER_ID);
      expect(result).toBe(true);
    });

    it('should return true when lender received the invitation (reverse direction)', async () => {
      // Borrower sent the invitation, lender accepted it
      prisma.contactInvitation.findFirst.mockResolvedValue({
        ...MOCK_INVITATION,
        senderUserId: RECIPIENT_USER_ID,
        recipientUserId: SENDER_USER_ID,
        status: InvitationStatus.ACCEPTED,
      });

      // hasAcceptedContact(lenderId=SENDER, borrowerUserId=RECIPIENT)
      const result = await service.hasAcceptedContact(SENDER_USER_ID, RECIPIENT_USER_ID);
      expect(result).toBe(true);
    });

    it('should return false when no ACCEPTED invitation exists', async () => {
      prisma.contactInvitation.findFirst.mockResolvedValue(null);

      const result = await service.hasAcceptedContact(SENDER_USER_ID, RECIPIENT_USER_ID);
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // FIX-28: only the authorized party sees the invitation, anyone else gets the
  // uniform 404, decided before any 409
  // ===========================================================================

  describe('uniform 404 for non-authorized users (FIX-28)', () => {
    const problemOf = async (call: Promise<unknown>): Promise<ProblemDetails> => {
      try {
        await call;
      } catch (error) {
        return (error as { getResponse: () => ProblemDetails }).getResponse();
      }
      throw new Error('Expected the call to reject');
    };

    const visibleFields = (
      problem: ProblemDetails,
    ): Pick<ProblemDetails, 'status' | 'type' | 'title' | 'detail'> => {
      const { status, type, title, detail } = problem;
      return { status, type, title, detail };
    };

    const withUsers = (invitation: ContactInvitation): never =>
      ({ ...invitation, senderUser: SENDER_USER, recipientUser: RECIPIENT_USER }) as never;

    const actions: Array<{
      name: string;
      // The user who is a party to the invitation but not allowed to do this action
      otherParty: string;
      run: (userId: string) => Promise<unknown>;
    }> = [
      {
        name: 'accept',
        otherParty: SENDER_USER_ID,
        run: (userId) => service.acceptInvitation(INVITATION_ID, userId),
      },
      {
        name: 'reject',
        otherParty: SENDER_USER_ID,
        run: (userId) => service.rejectInvitation(INVITATION_ID, userId),
      },
      {
        name: 'cancel',
        otherParty: RECIPIENT_USER_ID,
        run: (userId) => service.cancelInvitation(INVITATION_ID, userId),
      },
    ];

    describe.each(actions)('$name', ({ otherParty, run }) => {
      it('should answer a third party with the same 404 as a missing invitation', async () => {
        prisma.contactInvitation.findUnique.mockResolvedValueOnce(null);
        const missing = await problemOf(run(OTHER_USER_ID));

        prisma.contactInvitation.findUnique.mockResolvedValue(withUsers(MOCK_INVITATION));
        const foreign = await problemOf(run(OTHER_USER_ID));

        expect(foreign.status).toBe(HttpStatus.NOT_FOUND);
        expect(foreign.type).toContain('invitation-not-found');
        expect(visibleFields(foreign)).toEqual(visibleFields(missing));
      });

      it('should answer the other party with the same 404 (not 403)', async () => {
        prisma.contactInvitation.findUnique.mockResolvedValue(withUsers(MOCK_INVITATION));

        const problem = await problemOf(run(otherParty));

        expect(problem.status).toBe(HttpStatus.NOT_FOUND);
        expect(problem.type).toContain('invitation-not-found');
      });

      it('should answer 404 before 409 for a non-authorized user on an already accepted invitation', async () => {
        prisma.contactInvitation.findUnique.mockResolvedValue(
          withUsers({ ...MOCK_INVITATION, status: InvitationStatus.ACCEPTED }),
        );

        const problem = await problemOf(run(OTHER_USER_ID));

        expect(problem.status).toBe(HttpStatus.NOT_FOUND);
        expect(problem.type).toContain('invitation-not-found');
      });
    });
  });
});
