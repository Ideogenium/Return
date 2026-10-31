import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_EVENTS } from '../common/events/user.events.js';
import type { UserRegisteredEvent } from '../common/events/user.events.js';

/**
 * Listens to user registration events and links existing Borrower records
 * to the newly created User by matching email addresses.
 *
 * When a lender creates a contact (Borrower) with an email, Borrower.userId
 * stays NULL. When that person later registers on Return, this listener
 * automatically populates Borrower.userId via email matching.
 *
 * A single user can be a borrower for multiple lenders: each lender has their
 * own Borrower record for the same person. updateMany ensures ALL matching
 * records are linked.
 *
 * Ref: Sprint 4.5, INTEG-001 → INTEG-004
 */
@Injectable()
export class BorrowerLinkingListener {
  private readonly logger = new Logger(BorrowerLinkingListener.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * When a new user registers, find all Borrower records with the same email
   * that don't yet have a userId, and link them to the new user.
   */
  @OnEvent(USER_EVENTS.REGISTERED)
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const { userId, email } = event;

    const result = await this.prisma.borrower.updateMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        userId: null,
      },
      data: {
        userId,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Linked ${result.count} Borrower record(s) to User ${userId}`);
    }
  }
}
