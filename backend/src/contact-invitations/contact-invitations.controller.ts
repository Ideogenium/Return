import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { ContactInvitationsService } from './contact-invitations.service.js';
import { SendInvitationDto } from './dto/send-invitation.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';
import { ListInvitationsQueryDto } from './dto/list-invitations-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type {
  ContactInvitationResponse,
  PaginatedContactInvitationsResponse,
  PaginatedUserSearchResultsResponse,
} from './interfaces/contact-invitation-response.interface.js';

// =============================================================================
// ContactInvitationsController — Endpoints d'invitation de contacts
// =============================================================================
// Tous les endpoints requièrent un Bearer token (JwtAuthGuard).
// Le userId est TOUJOURS extrait du JWT (req.user.userId).
//
// Routes (préfixe global /v1 + prefix 'contact-invitations') :
//   POST   /v1/contact-invitations/search           → 200 OK   (search users)
//   POST   /v1/contact-invitations                   → 201 Created (send invitation)
//   GET    /v1/contact-invitations                   → 200 OK   (list invitations)
//   POST   /v1/contact-invitations/:id/accept        → 200 OK   (accept invitation)
//   POST   /v1/contact-invitations/:id/reject        → 204      (reject invitation)
//   DELETE /v1/contact-invitations/:id               → 204      (cancel invitation)
// =============================================================================

@Controller('contact-invitations')
@UseGuards(JwtAuthGuard)
export class ContactInvitationsController {
  constructor(private readonly contactInvitationsService: ContactInvitationsService) {}

  /**
   * POST /v1/contact-invitations/search
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchUsers(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: SearchUsersDto,
  ): Promise<PaginatedUserSearchResultsResponse> {
    return this.contactInvitationsService.searchUsers(req.user.userId, {
      query: dto.query,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    });
  }

  /**
   * POST /v1/contact-invitations
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendInvitation(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: SendInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ContactInvitationResponse> {
    const invitation = await this.contactInvitationsService.sendInvitation(req.user.userId, dto);
    const baseUrl = `${req.protocol}://${req.headers.host as string}`;
    res.setHeader('Location', `${baseUrl}/v1/contact-invitations/${invitation.id}`);
    return invitation;
  }

  /**
   * GET /v1/contact-invitations
   */
  @Get()
  async listInvitations(
    @Request() req: { user: AuthenticatedUser },
    @Query() query: ListInvitationsQueryDto,
  ): Promise<PaginatedContactInvitationsResponse> {
    return this.contactInvitationsService.listInvitations(req.user.userId, {
      direction: query.direction ?? 'received',
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  /**
   * POST /v1/contact-invitations/:invitationId/accept
   */
  @Post(':invitationId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Request() req: { user: AuthenticatedUser },
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<ContactInvitationResponse> {
    return this.contactInvitationsService.acceptInvitation(invitationId, req.user.userId);
  }

  /**
   * POST /v1/contact-invitations/:invitationId/reject
   */
  @Post(':invitationId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectInvitation(
    @Request() req: { user: AuthenticatedUser },
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.contactInvitationsService.rejectInvitation(invitationId, req.user.userId);
  }

  /**
   * DELETE /v1/contact-invitations/:invitationId
   */
  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvitation(
    @Request() req: { user: AuthenticatedUser },
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.contactInvitationsService.cancelInvitation(invitationId, req.user.userId);
  }
}
