import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../common/exceptions/problem-details.exception.js';
import { PHOTO_STORAGE } from '../storage/interfaces/photo-storage.interface.js';
import type { PhotoStorage } from '../storage/interfaces/photo-storage.interface.js';
import type { ItemResponse, PaginatedItemsResponse } from './interfaces/item-response.interface.js';
import type { PhotoResponse } from './interfaces/photo-response.interface.js';
import type { CreateItemDto } from './dto/create-item.dto.js';
import type { UpdateItemDto } from './dto/update-item.dto.js';
import type { Item, Photo, ItemCategory } from '@prisma/client';
import { ACTIVE_LOAN_STATUSES } from '../common/constants/loan-statuses.js';

// =============================================================================
// ItemsService — Logique métier du module Items
// =============================================================================

/** Maximum de photos par item (OpenAPI: maxItems 5) */
const MAX_PHOTOS_PER_ITEM = 5;

type ItemWithPhotos = Item & { photos: Photo[] };

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PHOTO_STORAGE) private readonly photoStorage: PhotoStorage,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(userId: string, dto: CreateItemDto): Promise<ItemResponse> {
    // Règle métier : estimatedValue obligatoire si category = MONEY
    if (
      dto.category === 'MONEY' &&
      (dto.estimatedValue === undefined || dto.estimatedValue === null)
    ) {
      throw new BadRequestException(
        'estimated-value-required',
        'Estimated Value Required',
        'estimatedValue is required when category is MONEY.',
        '/v1/items',
      );
    }

    const item = await this.prisma.item.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        estimatedValue: dto.estimatedValue ?? null,
        userId,
      },
      include: { photos: true },
    });

    return this.toItemResponse(item);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL (paginated)
  // ---------------------------------------------------------------------------

  async findAll(
    userId: string,
    query: {
      category?: ItemCategory;
      available?: boolean;
      page: number;
      limit: number;
    },
  ): Promise<PaginatedItemsResponse> {
    const { page, limit, category } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (category) {
      where.category = category;
    }

    // LOAN-036: Filter items by availability (no active loan)
    if (query.available === true) {
      where.loans = {
        none: {
          status: { in: ACTIVE_LOAN_STATUSES },
          deletedAt: null,
        },
      };
    } else if (query.available === false) {
      where.loans = {
        some: {
          status: { in: ACTIVE_LOAN_STATUSES },
          deletedAt: null,
        },
      };
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: { photos: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    return {
      data: items.map((item) => this.toItemResponse(item as ItemWithPhotos)),
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
  // FIND BY ID
  // ---------------------------------------------------------------------------

  async findById(itemId: string, userId: string): Promise<ItemResponse> {
    const item = await this.findItemOrFail(itemId);
    this.assertOwnership(item, userId);

    return this.toItemResponse(item);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(itemId: string, userId: string, dto: UpdateItemDto): Promise<ItemResponse> {
    const item = await this.findItemOrFail(itemId);
    this.assertOwnership(item, userId);

    // Règle métier : l'état final ne doit jamais avoir category=MONEY sans estimatedValue
    const finalCategory = dto.category ?? item.category;
    const finalValue = dto.estimatedValue !== undefined ? dto.estimatedValue : item.estimatedValue;
    if (finalCategory === 'MONEY' && (finalValue === undefined || finalValue === null)) {
      throw new BadRequestException(
        'estimated-value-required',
        'Estimated Value Required',
        'estimatedValue is required when category is MONEY.',
        `/v1/items/${itemId}`,
      );
    }

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data: dto,
      include: { photos: true },
    });

    return this.toItemResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async delete(itemId: string, userId: string): Promise<void> {
    const item = await this.findItemOrFail(itemId);
    this.assertOwnership(item, userId);

    // LOAN-039: Cannot delete an item that is currently in an active loan
    const activeLoanCount = await this.prisma.loan.count({
      where: {
        itemId,
        status: { in: ACTIVE_LOAN_STATUSES },
        deletedAt: null,
      },
    });
    if (activeLoanCount > 0) {
      throw new ConflictException(
        'item-currently-loaned',
        'Item Currently Loaned',
        'Cannot delete an item that is currently on loan.',
        `/v1/items/${itemId}`,
      );
    }

    // Soft delete : l'item reste en DB pour préserver l'historique des prêts
    await this.prisma.item.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // ADD PHOTO
  // ---------------------------------------------------------------------------

  async addPhoto(
    itemId: string,
    userId: string,
    file: Buffer,
    filename: string,
  ): Promise<PhotoResponse> {
    const item = await this.findItemOrFail(itemId);
    this.assertOwnership(item, userId);

    // Vérifier la limite de photos
    const photoCount = await this.prisma.photo.count({ where: { itemId } });
    if (photoCount >= MAX_PHOTOS_PER_ITEM) {
      throw new BadRequestException(
        'max-photos-exceeded',
        'Maximum Photos Exceeded',
        `An item can have a maximum of ${MAX_PHOTOS_PER_ITEM} photos.`,
        `/v1/items/${itemId}/photos`,
      );
    }

    // Upload vers le storage
    const ext = filename.split('.').pop() ?? 'jpg';
    // Owner prefix: lets account deletion purge every photo of a user by prefix,
    // even after the items themselves are gone.
    const key = `users/${userId}/items/${itemId}/${crypto.randomUUID()}.${ext}`;
    const uploadResult = await this.photoStorage.upload(file, key);

    // Créer l'enregistrement Photo en DB (rollback de l'upload si échec)
    try {
      const photo = await this.prisma.photo.create({
        data: {
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          itemId,
        },
      });
      return this.toPhotoResponse(photo);
    } catch (error) {
      await this.deleteStoredFile(uploadResult.key);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE PHOTO
  // ---------------------------------------------------------------------------

  async deletePhoto(itemId: string, photoId: string, userId: string): Promise<void> {
    const item = await this.findItemOrFail(itemId);
    this.assertOwnership(item, userId);

    const photo = item.photos.find((p) => p.id === photoId);
    if (!photo) {
      throw new NotFoundException('Photo', photoId, `/v1/items/${itemId}/photos/${photoId}`);
    }

    await this.prisma.photo.delete({ where: { id: photoId } });
    await this.deleteStoredFile(photo.url);
  }

  /** Best-effort: a storage failure is logged, never surfaced; the record is the source of truth. */
  private async deleteStoredFile(keyOrUrl: string): Promise<void> {
    try {
      await this.photoStorage.delete(keyOrUrl);
    } catch (error) {
      this.logger.warn(
        `Stored photo could not be deleted, left orphaned: ${keyOrUrl} (${(error as Error).message})`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private async findItemOrFail(itemId: string): Promise<ItemWithPhotos> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { photos: true },
    });

    if (!item || item.deletedAt !== null) {
      throw new NotFoundException('Item', itemId, `/v1/items/${itemId}`);
    }

    return item;
  }

  /** FIX-28: someone else's item is reported exactly like a missing one (no existence leak). */
  private assertOwnership(item: ItemWithPhotos, userId: string): void {
    if (item.userId !== userId) {
      throw new NotFoundException('Item', item.id, `/v1/items/${item.id}`);
    }
  }

  private toItemResponse(item: ItemWithPhotos): ItemResponse {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      estimatedValue: item.estimatedValue,
      photos: item.photos.map((p) => this.toPhotoResponse(p)),
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toPhotoResponse(photo: Photo): PhotoResponse {
    return {
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      uploadedAt: photo.uploadedAt.toISOString(),
    };
  }
}
