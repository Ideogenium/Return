import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request as ExpressRequest, Response } from 'express';
import { ItemsService } from './items.service.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { ListItemsQueryDto } from './dto/list-items-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { mimeToExtension } from '../common/utils/mime.util.js';
import {
  ITEM_PHOTO_MAX_BYTES,
  imageFilePipe,
  imageUploadOptions,
} from '../common/upload/upload-limits.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type { ItemResponse, PaginatedItemsResponse } from './interfaces/item-response.interface.js';
import type { PhotoResponse } from './interfaces/photo-response.interface.js';

// =============================================================================
// ItemsController — Endpoints CRUD items + photos
// =============================================================================
// Tous les endpoints requièrent un Bearer token (JwtAuthGuard).
// Le userId est TOUJOURS extrait du JWT (req.user.userId).
//
// Routes (préfixe global /v1 + prefix 'items') :
//   GET    /v1/items                       → 200 OK + PaginatedItemsResponse
//   POST   /v1/items                       → 201 Created + Location + ItemResponse
//   GET    /v1/items/:itemId               → 200 OK | 403 | 404
//   PATCH  /v1/items/:itemId               → 200 OK | 400 | 403 | 404
//   DELETE /v1/items/:itemId               → 204 No Content | 403 | 404 | 409
//   POST   /v1/items/:itemId/photos        → 201 Created + Location + PhotoResponse
//   DELETE /v1/items/:itemId/photos/:photoId → 204 No Content | 403 | 404
// =============================================================================

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  /**
   * POST /v1/items
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: CreateItemDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ItemResponse> {
    const item = await this.itemsService.create(req.user.userId, dto);
    const baseUrl = `${req.protocol}://${req.headers.host as string}`;
    res.setHeader('Location', `${baseUrl}/v1/items/${item.id}`);
    return item;
  }

  /**
   * GET /v1/items
   */
  @Get()
  async findAll(
    @Request() req: { user: AuthenticatedUser },
    @Query() query: ListItemsQueryDto,
  ): Promise<PaginatedItemsResponse> {
    return this.itemsService.findAll(req.user.userId, {
      category: query.category,
      available: query.available,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  /**
   * GET /v1/items/:itemId
   */
  @Get(':itemId')
  async findById(
    @Request() req: { user: AuthenticatedUser },
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<ItemResponse> {
    return this.itemsService.findById(itemId, req.user.userId);
  }

  /**
   * PATCH /v1/items/:itemId
   */
  @Patch(':itemId')
  async update(
    @Request() req: { user: AuthenticatedUser },
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemResponse> {
    return this.itemsService.update(itemId, req.user.userId, dto);
  }

  /**
   * DELETE /v1/items/:itemId
   */
  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: { user: AuthenticatedUser },
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.itemsService.delete(itemId, req.user.userId);
  }

  /**
   * POST /v1/items/:itemId/photos
   */
  @Post(':itemId/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('photo', imageUploadOptions(ITEM_PHOTO_MAX_BYTES)))
  async addPhoto(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile(imageFilePipe(ITEM_PHOTO_MAX_BYTES))
    file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PhotoResponse> {
    const safeFilename = `photo.${mimeToExtension(file.mimetype)}`;
    const photo = await this.itemsService.addPhoto(
      itemId,
      req.user.userId,
      file.buffer,
      safeFilename,
    );
    const baseUrl = `${req.protocol}://${req.headers.host as string}`;
    res.setHeader('Location', `${baseUrl}/v1/items/${itemId}/photos/${photo.id}`);
    return photo;
  }

  /**
   * DELETE /v1/items/:itemId/photos/:photoId
   */
  @Delete(':itemId/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(
    @Request() req: { user: AuthenticatedUser },
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.itemsService.deletePhoto(itemId, photoId, req.user.userId);
  }
}
