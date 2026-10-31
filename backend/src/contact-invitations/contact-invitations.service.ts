import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  ProblemDetailsException,
} from '../common/exceptions/problem-details.exception.js';
import { HttpStatus } from '@nestjs/common';
import { CONTACT_INVITATION_EVENTS } from '../common/events/contact-invitation.events.js';
import type {
  ContactInvitationAcceptedEvent,
  ContactInvitationRejectedEvent,
  ContactInvitationSentEvent,
} from '../common/events/contact-invitation.events.js';
import type {
  ContactInvitationResponse,
  PaginatedContactInvitationsResponse,
  PaginatedUserSearchResultsResponse,
  UserSearchResultResponse,
} from './interfaces/contact-invitation-response.interface.js';
import type { SendInvitationDto } from './dto/send-invitation.dto.js';
import { InvitationStatus, type ContactInvitation, type User, Prisma } from '@prisma/client';

/** Expiration period for invitations: 30 days */
const INVITATION_EXPIRY_DAYS = 30;

type ContactInvitationWithRelations = ContactInvitation & {
  senderUser: User;
  recipientUser: User;
};

// =============================================================================
// ContactInvitationsService — Logique métier du module Contact Invitations
// =============================================================================

@Injectable()
export class ContactInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // SEARCH USERS (CINV-004)
  // ---------------------------------------------------------------------------

  async searchUsers(
    senderId: string,
    params: { query: string; page?: number; limit?: number },
  ): Promise<PaginatedUserSearchResultsResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;
    const query = params.query;

    // Search by email (exact), firstName or lastName (contains, case-insensitive)
    const where: Prisma.UserWhereInput = {
      id: { not: senderId },
      OR: [
        { email: { equals: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Fetch pending invitations and existing borrowers for found users in parallel
    const userIds = users.map((u) => u.id);
    const [pendingInvitations, existingBorrowers] = await Promise.all([
      userIds.length > 0
        ? this.prisma.contactInvitation.findMany({
            where: {
              OR: [
                { senderUserId: senderId, recipientUserId: { in: userIds } },
                { senderUserId: { in: userIds }, recipientUserId: senderId },
              ],
              status: InvitationStatus.PENDING,
            },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.prisma.borrower.findMany({
            where: {
              lenderUserId: senderId,
              userId: { in: userIds },
            },
            select: { userId: true },
          })
        : Promise.resolve([]),
    ]);

    // alreadyContact is based on Borrower existence, not invitation history.
    // This ensures deleted contacts are not incorrectly shown as existing.
    const borrowerUserIdSet = new Set(existingBorrowers.map((b) => b.userId));

    const data: UserSearchResultResponse[] = users.map((user) => {
      const pendingInv = pendingInvitations.find(
        (inv) =>
          (inv.senderUserId === senderId && inv.recipientUserId === user.id) ||
          (inv.senderUserId === user.id && inv.recipientUserId === senderId),
      );

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        alreadyContact: borrowerUserIdSet.has(user.id),
        pendingInvitation: !!pendingInv,
        pendingInvitationId: pendingInv?.id ?? null,
      };
    });

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // SEND INVITATION (CINV-006)
  // ---------------------------------------------------------------------------

  async sendInvitation(
    senderId: string,
    dto: SendInvitationDto,
  ): Promise<ContactInvitationResponse> {
    const recipientEmail = dto.recipientEmail.trim();

    // Find recipient user (case-insensitive email lookup)
    const recipient = await this.prisma.user.findFirst({
      where: {
        email: { equals: recipientEmail, mode: 'insensitive' },
      },
    });

    if (!recipient) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'user-not-found',
        'User Not Found',
        'No registered user found with this email address.',
        '/v1/contact-invitations',
      );
    }

    // Cannot invite yourself
    if (recipient.id === senderId) {
      throw new BadRequestException(
        'self-invitation',
        'Self Invitation',
        'You cannot send an invitation to yourself.',
        '/v1/contact-invitations',
      );
    }

    // Check for existing PENDING invitation (use canonical email from DB)
    const canonicalEmail = recipient.email;
    const existingPending = await this.prisma.contactInvitation.findFirst({
      where: {
        senderUserId: senderId,
        recipientEmail: canonicalEmail,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'invitation-already-sent',
        'Invitation Already Sent',
        'A pending invitation already exists for this email.',
        '/v1/contact-invitations',
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.contactInvitation.create({
      data: {
        senderUserId: senderId,
        recipientEmail: canonicalEmail,
        recipientUserId: recipient.id,
        status: InvitationStatus.PENDING,
        expiresAt,
      },
      include: {
        senderUser: true,
        recipientUser: true,
      },
    });

    // Emit SENT event after the write succeeded (listener failures never reach the caller)
    const event: ContactInvitationSentEvent = {
      invitationId: invitation.id,
      senderUserId: invitation.senderUserId,
      recipientUserId: recipient.id,
      senderFirstName: invitation.senderUser.firstName,
      senderLastName: invitation.senderUser.lastName,
    };
    this.eventEmitter.emit(CONTACT_INVITATION_EVENTS.SENT, event);

    return this.toInvitationResponse(invitation as ContactInvitationWithRelations);
  }

  // ---------------------------------------------------------------------------
  // ACCEPT INVITATION (CINV-008)
  // ---------------------------------------------------------------------------

  async acceptInvitation(invitationId: string, userId: string): Promise<ContactInvitationResponse> {
    const invitation = await this.findInvitationOrFail(invitationId, {
      recipientUserId: userId,
    });

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        'invitation-not-pending',
        'Invitation Not Pending',
        'This invitation has already been accepted, rejected, or expired.',
        `/v1/contact-invitations/${invitationId}/accept`,
      );
    }

    // Transaction: update invitation + create Borrower
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contactInvitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        include: {
          senderUser: true,
          recipientUser: true,
        },
      });

      // Upsert Borrower in sender's contacts (Ismaël gets Ozias).
      // Uses upsert to safely handle pre-existing Borrower for the same
      // (lenderUserId, email) — avoids P2002 unique constraint violation.
      // userId MUST be set to avoid the Sprint 4.5 bug.
      const borrower = await tx.borrower.upsert({
        where: {
          lenderUserId_email: {
            lenderUserId: invitation.senderUserId,
            email: invitation.recipientEmail,
          },
        },
        update: {
          firstName: invitation.recipientUser.firstName,
          lastName: invitation.recipientUser.lastName,
          userId: invitation.recipientUserId,
        },
        create: {
          firstName: invitation.recipientUser.firstName,
          lastName: invitation.recipientUser.lastName,
          email: invitation.recipientEmail,
          userId: invitation.recipientUserId,
          lenderUserId: invitation.senderUserId,
        },
      });

      // Upsert Borrower in recipient's contacts (Ozias gets Ismaël).
      // The relationship is bidirectional: both users become contacts of each other.
      await tx.borrower.upsert({
        where: {
          lenderUserId_email: {
            lenderUserId: invitation.recipientUserId,
            email: invitation.senderUser.email,
          },
        },
        update: {
          firstName: invitation.senderUser.firstName,
          lastName: invitation.senderUser.lastName,
          userId: invitation.senderUserId,
        },
        create: {
          firstName: invitation.senderUser.firstName,
          lastName: invitation.senderUser.lastName,
          email: invitation.senderUser.email,
          userId: invitation.senderUserId,
          lenderUserId: invitation.recipientUserId,
        },
      });

      return { updated, borrower };
    });

    // Emit ACCEPTED event (outside transaction)
    const event: ContactInvitationAcceptedEvent = {
      invitationId,
      senderUserId: invitation.senderUserId,
      recipientUserId: invitation.recipientUserId,
      recipientEmail: invitation.recipientEmail,
      borrowerId: result.borrower.id,
    };
    this.eventEmitter.emit(CONTACT_INVITATION_EVENTS.ACCEPTED, event);

    return this.toInvitationResponse(result.updated as ContactInvitationWithRelations);
  }

  // ---------------------------------------------------------------------------
  // REJECT INVITATION (CINV-010)
  // ---------------------------------------------------------------------------

  async rejectInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.findInvitationOrFail(invitationId, {
      recipientUserId: userId,
    });

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        'invitation-not-pending',
        'Invitation Not Pending',
        'This invitation has already been accepted, rejected, or expired.',
        `/v1/contact-invitations/${invitationId}/reject`,
      );
    }

    await this.prisma.contactInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });

    // Emit REJECTED event
    const event: ContactInvitationRejectedEvent = {
      invitationId,
      senderUserId: invitation.senderUserId,
      recipientUserId: invitation.recipientUserId,
    };
    this.eventEmitter.emit(CONTACT_INVITATION_EVENTS.REJECTED, event);
  }

  // ---------------------------------------------------------------------------
  // CANCEL INVITATION (DELETE)
  // ---------------------------------------------------------------------------

  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.findInvitationOrFail(invitationId, { senderUserId: userId });

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException(
        'invitation-already-accepted',
        'Invitation Already Accepted',
        'Cannot cancel an invitation that has already been accepted.',
        `/v1/contact-invitations/${invitationId}`,
      );
    }

    await this.prisma.contactInvitation.delete({
      where: { id: invitationId },
    });
  }

  // ---------------------------------------------------------------------------
  // LIST INVITATIONS (CINV-010)
  // ---------------------------------------------------------------------------

  async listInvitations(
    userId: string,
    params: { direction?: string; status?: string; page?: number; limit?: number },
  ): Promise<PaginatedContactInvitationsResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;
    const direction = params.direction ?? 'received';

    const where: Prisma.ContactInvitationWhereInput = {};

    if (direction === 'sent') {
      where.senderUserId = userId;
    } else {
      where.recipientUserId = userId;
    }

    if (params.status) {
      where.status = params.status as InvitationStatus;
    }

    const [invitations, totalItems] = await Promise.all([
      this.prisma.contactInvitation.findMany({
        where,
        include: {
          senderUser: true,
          recipientUser: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactInvitation.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data: invitations.map((inv) =>
        this.toInvitationResponse(inv as ContactInvitationWithRelations),
      ),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // HAS ACCEPTED CONTACT (for LoansService — CINV-019)
  // ---------------------------------------------------------------------------

  async hasAcceptedContact(senderUserId: string, recipientUserId: string): Promise<boolean> {
    // Check both directions: the lender may have sent OR received the invitation.
    const invitation = await this.prisma.contactInvitation.findFirst({
      where: {
        OR: [
          { senderUserId, recipientUserId, status: InvitationStatus.ACCEPTED },
          {
            senderUserId: recipientUserId,
            recipientUserId: senderUserId,
            status: InvitationStatus.ACCEPTED,
          },
        ],
      },
    });
    return invitation !== null;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Loads an invitation visible to the caller. `allowed` names who may act on it: anyone else
   * (the other party included) gets the same 404 as for a missing invitation, decided before
   * any 409 so that ids cannot be probed (FIX-28).
   */
  private async findInvitationOrFail(
    invitationId: string,
    allowed: { recipientUserId: string } | { senderUserId: string },
  ): Promise<ContactInvitationWithRelations> {
    const invitation = await this.prisma.contactInvitation.findUnique({
      where: { id: invitationId },
      include: {
        senderUser: true,
        recipientUser: true,
      },
    });

    const isAllowed =
      invitation !== null &&
      ('recipientUserId' in allowed
        ? invitation.recipientUserId === allowed.recipientUserId
        : invitation.senderUserId === allowed.senderUserId);

    if (!invitation || !isAllowed) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'invitation-not-found',
        'Invitation Not Found',
        'The invitation does not exist or does not belong to you.',
        `/v1/contact-invitations/${invitationId}`,
      );
    }

    return invitation as ContactInvitationWithRelations;
  }

  private toInvitationResponse(
    invitation: ContactInvitationWithRelations,
  ): ContactInvitationResponse {
    return {
      id: invitation.id,
      status: invitation.status,
      senderUser: {
        id: invitation.senderUser.id,
        firstName: invitation.senderUser.firstName,
        lastName: invitation.senderUser.lastName,
      },
      recipientEmail: invitation.recipientEmail,
      recipientUser: {
        id: invitation.recipientUser.id,
        firstName: invitation.recipientUser.firstName,
        lastName: invitation.recipientUser.lastName,
      },
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      rejectedAt: invitation.rejectedAt?.toISOString() ?? null,
    };
  }
}
