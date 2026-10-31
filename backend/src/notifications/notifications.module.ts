import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DeviceTokensService } from './device-tokens.service.js';
import { LoanNotificationListener } from './loan-notification.listener.js';
import { ContactInvitationNotificationListener } from './contact-invitation-notification.listener.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DeviceTokensService,
    LoanNotificationListener,
    ContactInvitationNotificationListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
