import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ReminderStatus } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import {
  ConflictException,
  NotFoundException,
} from '../common/exceptions/problem-details.exception.js';
import { RemindersService } from './reminders.service.js';
import type { ReminderResponse } from './interfaces/reminder-response.interface.js';

// =============================================================================
// RemindersController — HTTP endpoints for reminders
// =============================================================================
// All endpoints require a Bearer token (JwtAuthGuard).
// The userId is ALWAYS extracted from the JWT (req.user.userId).
//
// Routes (global prefix /v1):
//   GET  /v1/loans/:loanId/reminders          → 200 OK (array)
//   GET  /v1/reminders/:reminderId             → 200 OK
//   POST /v1/reminders/:reminderId/cancel      → 204 No Content
// =============================================================================

@Controller()
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /**
   * GET /v1/loans/:loanId/reminders
   * List all reminders for a loan. Only the lender can access.
   */
  @Get('loans/:loanId/reminders')
  async findByLoan(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
  ): Promise<ReminderResponse[]> {
    const loan = await this.remindersService.findLoanForReminders(
      loanId,
      `/v1/loans/${loanId}/reminders`,
    );
    this.remindersService.assertLoanOwnership(
      loan,
      req.user.userId,
      `/v1/loans/${loanId}/reminders`,
      { name: 'Loan', id: loanId },
    );

    return this.remindersService.findByLoanId(loanId);
  }

  /**
   * GET /v1/reminders/:reminderId
   * Get a single reminder. Only the lender of the associated loan can view.
   */
  @Get('reminders/:reminderId')
  async findById(
    @Param('reminderId', ParseUUIDPipe) reminderId: string,
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
  ): Promise<ReminderResponse> {
    const reminder = await this.remindersService.findById(reminderId);

    if (!reminder) {
      throw new NotFoundException('Reminder', reminderId, `/v1/reminders/${reminderId}`);
    }

    this.remindersService.assertLoanOwnership(
      reminder.loan,
      req.user.userId,
      `/v1/reminders/${reminderId}`,
      { name: 'Reminder', id: reminderId },
    );

    return this.remindersService.toReminderResponse(reminder);
  }

  /**
   * POST /v1/reminders/:reminderId/cancel
   * Cancel a scheduled reminder. Only the lender of the associated loan can cancel.
   */
  @Post('reminders/:reminderId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('reminderId', ParseUUIDPipe) reminderId: string,
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
  ): Promise<void> {
    const reminder = await this.remindersService.findById(reminderId);

    if (!reminder) {
      throw new NotFoundException('Reminder', reminderId, `/v1/reminders/${reminderId}/cancel`);
    }

    this.remindersService.assertLoanOwnership(
      reminder.loan,
      req.user.userId,
      `/v1/reminders/${reminderId}/cancel`,
      { name: 'Reminder', id: reminderId },
    );

    if (reminder.status === ReminderStatus.SENT) {
      throw new ConflictException(
        'reminder-already-sent',
        'Reminder Already Sent',
        'Cannot cancel a reminder that has already been sent.',
        `/v1/reminders/${reminderId}/cancel`,
      );
    }

    await this.remindersService.cancel(reminderId);
  }
}
