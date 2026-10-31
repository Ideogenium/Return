import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ItemCategory } from '@prisma/client';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '../common/exceptions/problem-details.exception.js';
import { PHOTO_STORAGE } from '../storage/interfaces/photo-storage.interface.js';

// =============================================================================
// ItemsService — Unit Tests (TDD)
// =============================================================================

describe('ItemsService', () => {
  let service: ItemsService;
  let prisma: {
    item: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    photo: {
      create: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
    loan: {
      count: jest.Mock;
    };
  };
  let photoStorage: {
    upload: jest.Mock;
    delete: jest.Mock;
    getUrl: jest.Mock;
  };

  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
  const ITEM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockItem = {
    id: ITEM_ID,
    name: 'Perceuse Bosch',
    description: 'Perceuse sans fil 18V',
    category: ItemCategory.TOOLS,
    estimatedValue: 129.99,
    userId: USER_ID,
    deletedAt: null,
    createdAt: new Date('2026-02-08T14:00:00Z'),
    updatedAt: new Date('2026-02-08T14:00:00Z'),
  };

  const mockItemWithPhotos = {
    ...mockItem,
    photos: [
      {
        id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
        url: 'http://localhost:3000/uploads/items/test/photo1.jpg',
        thumbnailUrl: null,
        itemId: ITEM_ID,
        uploadedAt: new Date('2026-02-08T14:05:00Z'),
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      item: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      photo: {
        create: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      loan: {
        count: jest.fn(),
      },
    };

    photoStorage = {
      upload: jest.fn(),
      delete: jest.fn(),
      getUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PHOTO_STORAGE, useValue: photoStorage },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    it('should create an item and return ItemResponse', async () => {
      prisma.item.create.mockResolvedValue({ ...mockItem, photos: [] });

      const result = await service.create(USER_ID, {
        name: 'Perceuse Bosch',
        description: 'Perceuse sans fil 18V',
        category: ItemCategory.TOOLS,
        estimatedValue: 129.99,
      });

      expect(result).toEqual({
        id: ITEM_ID,
        name: 'Perceuse Bosch',
        description: 'Perceuse sans fil 18V',
        category: 'TOOLS',
        estimatedValue: 129.99,
        photos: [],
        createdAt: '2026-02-08T14:00:00.000Z',
      });

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          name: 'Perceuse Bosch',
          description: 'Perceuse sans fil 18V',
          category: ItemCategory.TOOLS,
          estimatedValue: 129.99,
          userId: USER_ID,
        },
        include: { photos: true },
      });
    });

    it('should create an item with null optional fields', async () => {
      const minimalItem = {
        ...mockItem,
        description: null,
        estimatedValue: null,
        photos: [],
      };
      prisma.item.create.mockResolvedValue(minimalItem);

      const result = await service.create(USER_ID, {
        name: 'Livre',
        category: ItemCategory.BOOKS,
      });

      expect(result.description).toBeNull();
      expect(result.estimatedValue).toBeNull();
      expect(result.photos).toEqual([]);
    });

    it('should throw BadRequestException when category is MONEY and estimatedValue is missing', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Prêt à Pierre',
          category: ItemCategory.MONEY,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // FIND ALL (paginated)
  // ===========================================================================

  describe('findAll', () => {
    it('should return paginated items', async () => {
      prisma.item.findMany.mockResolvedValue([{ ...mockItem, photos: [] }]);
      prisma.item.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should filter by category', async () => {
      prisma.item.findMany.mockResolvedValue([]);
      prisma.item.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        category: ItemCategory.TOOLS,
        page: 1,
        limit: 20,
      });

      expect(prisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: ItemCategory.TOOLS,
          }),
        }),
      );
    });

    it('should return empty pagination when no items', async () => {
      prisma.item.findMany.mockResolvedValue([]);
      prisma.item.count.mockResolvedValue(0);

      const result = await service.findAll(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should calculate hasNextPage correctly', async () => {
      prisma.item.findMany.mockResolvedValue([{ ...mockItem, photos: [] }]);
      prisma.item.count.mockResolvedValue(25);

      const result = await service.findAll(USER_ID, { page: 1, limit: 20 });

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  // ===========================================================================
  // FIND BY ID
  // ===========================================================================

  describe('findById', () => {
    it('should return an item with photos', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);

      const result = await service.findById(ITEM_ID, USER_ID);

      expect(result.id).toBe(ITEM_ID);
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].url).toBe('http://localhost:3000/uploads/items/test/photo1.jpg');
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.findById(ITEM_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the item', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);

      await expect(service.findById(ITEM_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('update', () => {
    it('should update an item and return updated response', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.item.update.mockResolvedValue({
        ...mockItemWithPhotos,
        name: 'Perceuse Bosch Pro',
      });

      const result = await service.update(ITEM_ID, USER_ID, {
        name: 'Perceuse Bosch Pro',
      });

      expect(result.name).toBe('Perceuse Bosch Pro');
      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { name: 'Perceuse Bosch Pro' },
        include: { photos: true },
      });
    });

    it('should throw NotFoundException when updating non-existent item', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.update(ITEM_ID, USER_ID, { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when updating another user item', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);

      await expect(service.update(ITEM_ID, OTHER_USER_ID, { name: 'Hack' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when changing category to MONEY without estimatedValue', async () => {
      const itemWithoutValue = {
        ...mockItemWithPhotos,
        estimatedValue: null,
      };
      prisma.item.findUnique.mockResolvedValue(itemWithoutValue);

      await expect(
        service.update(ITEM_ID, USER_ID, { category: ItemCategory.MONEY }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when setting estimatedValue to null on MONEY item', async () => {
      const moneyItem = {
        ...mockItemWithPhotos,
        category: ItemCategory.MONEY,
        estimatedValue: 50,
      };
      prisma.item.findUnique.mockResolvedValue(moneyItem);

      await expect(service.update(ITEM_ID, USER_ID, { estimatedValue: null })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ===========================================================================
  // DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should soft-delete an item (set deletedAt)', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.loan.count.mockResolvedValue(0);
      prisma.item.update.mockResolvedValue({ ...mockItemWithPhotos, deletedAt: new Date() });

      await service.delete(ITEM_ID, USER_ID);

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when deleting non-existent item', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.delete(ITEM_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user item', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);

      await expect(service.delete(ITEM_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('should throw 409 ConflictException when item has active loans (LOAN-039)', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.loan.count.mockResolvedValue(1);

      await expect(service.delete(ITEM_ID, USER_ID)).rejects.toThrow(ConflictException);
    });
  });

  // ===========================================================================
  // ADD PHOTO
  // ===========================================================================

  describe('addPhoto', () => {
    it('should upload photo and create record', async () => {
      prisma.item.findUnique.mockResolvedValue({
        ...mockItem,
        photos: [],
      });
      prisma.photo.count.mockResolvedValue(0);
      photoStorage.upload.mockResolvedValue({
        key: 'items/test/photo.jpg',
        url: 'http://localhost:3000/uploads/items/test/photo.jpg',
        thumbnailUrl: null,
      });
      prisma.photo.create.mockResolvedValue({
        id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
        url: 'http://localhost:3000/uploads/items/test/photo.jpg',
        thumbnailUrl: null,
        itemId: ITEM_ID,
        uploadedAt: new Date('2026-02-08T14:05:00Z'),
      });

      const result = await service.addPhoto(
        ITEM_ID,
        USER_ID,
        Buffer.from('fake-image'),
        'photo.jpg',
      );

      expect(result.url).toBe('http://localhost:3000/uploads/items/test/photo.jpg');
      expect(photoStorage.upload).toHaveBeenCalledTimes(1);
      expect(prisma.photo.create).toHaveBeenCalledTimes(1);
    });

    it("should store the photo under the owner's prefix so an account's photos can be purged by prefix", async () => {
      prisma.item.findUnique.mockResolvedValue({ ...mockItem, photos: [] });
      prisma.photo.count.mockResolvedValue(0);
      photoStorage.upload.mockResolvedValue({
        key: 'k',
        url: 'https://photos.example/k',
        thumbnailUrl: null,
      });
      prisma.photo.create.mockResolvedValue({
        id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
        url: 'https://photos.example/k',
        thumbnailUrl: null,
        itemId: ITEM_ID,
        uploadedAt: new Date('2026-02-08T14:05:00Z'),
      });

      await service.addPhoto(ITEM_ID, USER_ID, Buffer.from('img'), 'photo.png');

      expect(photoStorage.upload).toHaveBeenCalledWith(
        Buffer.from('img'),
        expect.stringMatching(
          new RegExp(`^users/${USER_ID}/items/${ITEM_ID}/[0-9a-f-]{36}\\.png$`),
        ),
      );
    });

    it('should delete the uploaded file and rethrow when the photo record cannot be saved', async () => {
      prisma.item.findUnique.mockResolvedValue({ ...mockItem, photos: [] });
      prisma.photo.count.mockResolvedValue(0);
      photoStorage.upload.mockResolvedValue({
        key: 'users/u/items/i/abc.jpg',
        url: 'https://photos.example/users/u/items/i/abc.jpg',
        thumbnailUrl: null,
      });
      const dbError = new Error('database unavailable');
      prisma.photo.create.mockRejectedValue(dbError);

      await expect(
        service.addPhoto(ITEM_ID, USER_ID, Buffer.from('img'), 'photo.jpg'),
      ).rejects.toBe(dbError);
      expect(photoStorage.delete).toHaveBeenCalledWith('users/u/items/i/abc.jpg');
    });

    it('should rethrow the database error even if the rollback deletion fails', async () => {
      prisma.item.findUnique.mockResolvedValue({ ...mockItem, photos: [] });
      prisma.photo.count.mockResolvedValue(0);
      photoStorage.upload.mockResolvedValue({ key: 'k', url: 'u', thumbnailUrl: null });
      const dbError = new Error('database unavailable');
      prisma.photo.create.mockRejectedValue(dbError);
      photoStorage.delete.mockRejectedValue(new Error('storage unavailable'));

      await expect(
        service.addPhoto(ITEM_ID, USER_ID, Buffer.from('img'), 'photo.jpg'),
      ).rejects.toBe(dbError);
    });

    it('should throw when max photos (5) exceeded', async () => {
      prisma.item.findUnique.mockResolvedValue({
        ...mockItem,
        photos: [],
      });
      prisma.photo.count.mockResolvedValue(5);

      await expect(
        service.addPhoto(ITEM_ID, USER_ID, Buffer.from('img'), 'pic.jpg'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent item', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(
        service.addPhoto(ITEM_ID, USER_ID, Buffer.from('img'), 'pic.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the item', async () => {
      prisma.item.findUnique.mockResolvedValue({
        ...mockItem,
        photos: [],
      });

      await expect(
        service.addPhoto(ITEM_ID, OTHER_USER_ID, Buffer.from('img'), 'pic.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===========================================================================
  // DELETE PHOTO
  // ===========================================================================

  describe('deletePhoto', () => {
    const PHOTO_ID = 'pppppppp-pppp-pppp-pppp-pppppppppppp';

    it('should delete a photo from storage and database', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.photo.delete.mockResolvedValue(mockItemWithPhotos.photos[0]);

      await service.deletePhoto(ITEM_ID, PHOTO_ID, USER_ID);

      expect(photoStorage.delete).toHaveBeenCalledWith(
        'http://localhost:3000/uploads/items/test/photo1.jpg',
      );
      expect(prisma.photo.delete).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
      });
    });

    it('should remove the database record before the stored file, so a record never points to a deleted file', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.photo.delete.mockResolvedValue(mockItemWithPhotos.photos[0]);

      await service.deletePhoto(ITEM_ID, PHOTO_ID, USER_ID);

      expect(prisma.photo.delete.mock.invocationCallOrder[0]).toBeLessThan(
        photoStorage.delete.mock.invocationCallOrder[0],
      );
    });

    it('should succeed when the stored file cannot be deleted (storage outage must not block the user)', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);
      prisma.photo.delete.mockResolvedValue(mockItemWithPhotos.photos[0]);
      photoStorage.delete.mockRejectedValue(new Error('storage unavailable'));

      await expect(service.deletePhoto(ITEM_ID, PHOTO_ID, USER_ID)).resolves.toBeUndefined();
      expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: PHOTO_ID } });
    });

    it('should throw NotFoundException when item does not exist', async () => {
      prisma.item.findUnique.mockResolvedValue(null);

      await expect(service.deletePhoto(ITEM_ID, PHOTO_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own the item', async () => {
      prisma.item.findUnique.mockResolvedValue(mockItemWithPhotos);

      await expect(service.deletePhoto(ITEM_ID, PHOTO_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when photo does not exist on item', async () => {
      prisma.item.findUnique.mockResolvedValue({
        ...mockItem,
        photos: [],
      });

      await expect(service.deletePhoto(ITEM_ID, 'nonexistent-photo-id', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
