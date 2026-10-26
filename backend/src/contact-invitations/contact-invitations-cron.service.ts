import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvitationStatus } from '@prisma/client';

/**
 * CRON job: expire pending contact invitations after 30 days.
 *
 * Runs daily at 3:00 AM to find PENDING invitations whose expiresAt
 * has passed and transitions them to EXPIRED.
 *
 * Ref: CINV-018
 */
@Injectable()
export class ContactInvitationsCronService {
  private readonly logger = new Logger(ContactInvitationsCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async handleExpiredInvitations(): Promise<void> {
    const now = new Date();

    const result = await this.prisma.contactInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: now },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    // One line per run, even when idle: a silent job is indistinguishable from a dead one.
    this.logger.log(`Invitations tick: ${result.count} expired`);
  }
}
