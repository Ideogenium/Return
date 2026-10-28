import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from './users.service.js';
import { UserRole } from '@prisma/client';
import { PHOTO_STORAGE } from '../storage/interfaces/photo-storage.interface.js';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';

// =============================================================================
// Mock bcrypt
// =============================================================================

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as {
  hash: jest.Mock;
  compare: jest.Mock;
};

// =============================================================================
// Fixtures
// =============================================================================

const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'john@example.com',
  password: '$2b$12$hashedPasswordValue',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.LENDER,
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

// =============================================================================
// Test Suite
// =============================================================================

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;
  let redisService: {
    blacklistToken: jest.Mock;
    isTokenBlacklisted: jest.Mock;
  };
  let photoStorage: {
    upload: jest.Mock;
    delete: jest.Mock;
    getUrl: jest.Mock;
    deleteByPrefix: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = mockDeep<PrismaService>();
    redisService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    };
    photoStorage = {
      upload: jest.fn(),
      delete: jest.fn(),
      getUrl: jest.fn(),
      deleteByPrefix: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: PHOTO_STORAGE, useValue: photoStorage },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ===========================================================================
  // GET /users/me — getProfile
  // ===========================================================================

  describe('getProfile', () => {
    it('should return SafeUser without password, with nested settings', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      // Act
      const result = await service.getProfile(MOCK_USER.id);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: MOCK_USER.id,
          email: MOCK_USER.email,
          firstName: MOCK_USER.firstName,
          lastName: MOCK_USER.lastName,
          settings: expect.objectContaining({
            pushNotificationsEnabled: true,
            reminderEnabled: true,
            language: 'fr',
            timezone: 'Europe/Paris',
          }),
        }),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.getProfile('non-existent-id');
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  // ===========================================================================
  // PATCH /users/me — updateProfile
  // ===========================================================================

  describe('updateProfile', () => {
    it('should update firstName and lastName', async () => {
      // Arrange
      const updated = { ...MOCK_USER, firstName: 'Jane', lastName: 'Smith' };
      prisma.user.update.mockResolvedValue(updated);

      // Act
      const result = await service.updateProfile(MOCK_USER.id, {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: { firstName: 'Jane', lastName: 'Smith' },
      });
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
    });

    it('should update email if unique', async () => {
      // Arrange
      const updated = { ...MOCK_USER, email: 'new@example.com' };
      prisma.user.update.mockResolvedValue(updated);

      // Act
      const result = await service.updateProfile(MOCK_USER.id, {
        email: 'new@example.com',
      });

      // Assert
      expect(result.email).toBe('new@example.com');
    });

    it('should throw ConflictException (409) if email already taken', async () => {
      // Arrange — Prisma unique constraint violation
      const prismaError = new Error('Unique constraint failed') as Error & {
        code: string;
        meta: { target: string[] };
      };
      prismaError.code = 'P2002';
      prismaError.meta = { target: ['email'] };
      prisma.user.update.mockRejectedValue(prismaError);

      // Act & Assert
      try {
        await service.updateProfile(MOCK_USER.id, {
          email: 'taken@example.com',
        });
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);

        const body = exception.getResponse();
        expect(body.type).toContain('email-already-exists');
      }
    });

    it('should not update if dto is empty', async () => {
      // Arrange
      prisma.user.update.mockResolvedValue(MOCK_USER);

      // Act
      await service.updateProfile(MOCK_USER.id, {});

      // Assert — Prisma est quand même appelé, data sera un objet vide
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: {},
      });
    });
  });

  // ===========================================================================
  // DELETE /users/me — deleteAccount
  // ===========================================================================

  describe('deleteAccount', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      bcrypt.compare.mockResolvedValue(true);
    });

    it('should verify password and delete user', async () => {
      // Act
      await service.deleteAccount(MOCK_USER.id, {
        password: 'StrongPass1!',
        confirmationText: 'DELETE MY ACCOUNT',
      });

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('StrongPass1!', MOCK_USER.password);
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // Arrange
      bcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      try {
        await service.deleteAccount(MOCK_USER.id, {
          password: 'wrong',
          confirmationText: 'DELETE MY ACCOUNT',
        });
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

        const body = exception.getResponse();
        expect(body.type).toContain('invalid-current-password');
      }
    });

    describe('purge of the stored photos (GDPR right to erasure)', () => {
      const DTO = { password: 'StrongPass1!', confirmationText: 'DELETE MY ACCOUNT' as const };

      it("purges every photo stored under the user's folder (avatar and all item photos)", async () => {
        await service.deleteAccount(MOCK_USER.id, DTO);

        expect(photoStorage.deleteByPrefix).toHaveBeenCalledWith(`users/${MOCK_USER.id}/`);
      });

      it('purges only after the account is deleted, so a failed deletion never loses photos', async () => {
        await service.deleteAccount(MOCK_USER.id, DTO);

        expect(prisma.user.delete.mock.invocationCallOrder[0]).toBeLessThan(
          photoStorage.deleteByPrefix.mock.invocationCallOrder[0],
        );
      });

      it('still succeeds when the storage purge fails: the account is already deleted', async () => {
        photoStorage.deleteByPrefix.mockRejectedValue(new Error('R2 unavailable'));

        await expect(service.deleteAccount(MOCK_USER.id, DTO)).resolves.toBeUndefined();
        expect(prisma.user.delete).toHaveBeenCalled();
      });

      it('does not purge anything when the password is wrong', async () => {
        bcrypt.compare.mockResolvedValue(false);

        await expect(service.deleteAccount(MOCK_USER.id, DTO)).rejects.toBeDefined();
        expect(photoStorage.deleteByPrefix).not.toHaveBeenCalled();
      });

      it('does not purge anything while active loans block the deletion', async () => {
        prisma.loan.count.mockResolvedValue(1);

        await expect(service.deleteAccount(MOCK_USER.id, DTO)).rejects.toBeDefined();
        expect(photoStorage.deleteByPrefix).not.toHaveBeenCalled();
      });

      it('does not purge anything when the database deletion fails', async () => {
        prisma.user.delete.mockRejectedValue(new Error('database unavailable'));

        await expect(service.deleteAccount(MOCK_USER.id, DTO)).rejects.toThrow(
          'database unavailable',
        );
        expect(photoStorage.deleteByPrefix).not.toHaveBeenCalled();
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.deleteAccount('non-existent-id', {
          password: 'StrongPass1!',
          confirmationText: 'DELETE MY ACCOUNT',
        });
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
        };
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  // ===========================================================================
  // PATCH /users/me/password — changePassword
  // ===========================================================================

  describe('changePassword', () => {
    const JTI = 'mock-jti-uuid';
    const TOKEN_EXP = Math.floor(Date.now() / 1000) + 600;

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('$2b$12$newHashedPassword');
    });

    it('should verify current password, hash new one, and update', async () => {
      // Act
      await service.changePassword(
        MOCK_USER.id,
        { currentPassword: 'StrongPass1!', newPassword: 'NewPass1!' },
        JTI,
        TOKEN_EXP,
      );

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('StrongPass1!', MOCK_USER.password);
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass1!', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: { password: '$2b$12$newHashedPassword' },
      });
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      // Arrange
      bcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      try {
        await service.changePassword(
          MOCK_USER.id,
          { currentPassword: 'wrong', newPassword: 'NewPass1!' },
          JTI,
          TOKEN_EXP,
        );
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

        const body = exception.getResponse();
        expect(body.type).toContain('invalid-current-password');
      }
    });

    it('should revoke ALL tokens after password change (ADR-004)', async () => {
      // Act
      await service.changePassword(
        MOCK_USER.id,
        { currentPassword: 'StrongPass1!', newPassword: 'NewPass1!' },
        JTI,
        TOKEN_EXP,
      );

      // Assert — Blacklist du jti courant dans Redis
      expect(redisService.blacklistToken).toHaveBeenCalledWith(JTI, expect.any(Number));
      // Assert — Suppression de TOUS les refresh tokens
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER.id },
      });
    });
  });

  // ===========================================================================
  // GET /users/me/settings — getSettings
  // ===========================================================================

  describe('getSettings', () => {
    it('should return user settings fields only', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      // Act
      const result = await service.getSettings(MOCK_USER.id);

      // Assert — Seuls les champs de préférences, pas le profil complet
      expect(result).toEqual({
        pushNotificationsEnabled: true,
        reminderEnabled: true,
        language: 'fr',
        timezone: 'Europe/Paris',
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.getSettings('non-existent-id');
        fail('Should have thrown');
      } catch (error) {
        const exception = error as { getStatus: () => number };
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  // ===========================================================================
  // PATCH /users/me/settings — updateSettings
  // ===========================================================================

  describe('updateSettings', () => {
    it('should update settings fields and return updated settings', async () => {
      // Arrange
      const updated = {
        ...MOCK_USER,
        language: 'en',
        pushNotificationsEnabled: false,
      };
      prisma.user.update.mockResolvedValue(updated);

      // Act
      const result = await service.updateSettings(MOCK_USER.id, {
        language: 'en',
        pushNotificationsEnabled: false,
      });

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: { language: 'en', pushNotificationsEnabled: false },
      });
      expect(result).toEqual({
        pushNotificationsEnabled: false,
        reminderEnabled: true,
        language: 'en',
        timezone: 'Europe/Paris',
      });
    });
  });

  // ===========================================================================
  // PUT /users/me/avatar — updateAvatar
  // ===========================================================================

  describe('updateAvatar', () => {
    it('should upload avatar and update profilePicture', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      photoStorage.upload.mockResolvedValue({
        key: 'users/550e8400-e29b-41d4-a716-446655440000/avatar.jpg',
        url: 'http://localhost:3000/uploads/users/550e8400-e29b-41d4-a716-446655440000/avatar.jpg',
        thumbnailUrl: null,
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        profilePicture:
          'http://localhost:3000/uploads/users/550e8400-e29b-41d4-a716-446655440000/avatar.jpg',
      });

      const result = await service.updateAvatar(
        MOCK_USER.id,
        Buffer.from('fake-image'),
        'avatar.jpg',
      );

      expect(result.profilePicture).toBe(
        'http://localhost:3000/uploads/users/550e8400-e29b-41d4-a716-446655440000/avatar.jpg',
      );
      expect(photoStorage.upload).toHaveBeenCalledWith(
        Buffer.from('fake-image'),
        expect.stringMatching(new RegExp(`^users/${MOCK_USER.id}/avatar-[0-9a-f-]{36}\\.jpg$`)),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: {
          profilePicture:
            'http://localhost:3000/uploads/users/550e8400-e29b-41d4-a716-446655440000/avatar.jpg',
        },
      });
    });

    it('should delete old avatar before uploading new one', async () => {
      const userWithAvatar = {
        ...MOCK_USER,
        profilePicture: 'http://localhost:3000/uploads/users/old-avatar.jpg',
      };
      prisma.user.findUnique.mockResolvedValue(userWithAvatar);
      photoStorage.upload.mockResolvedValue({
        key: `users/${MOCK_USER.id}/avatar.png`,
        url: `http://localhost:3000/uploads/users/${MOCK_USER.id}/avatar.png`,
        thumbnailUrl: null,
      });
      prisma.user.update.mockResolvedValue({
        ...userWithAvatar,
        profilePicture: `http://localhost:3000/uploads/users/${MOCK_USER.id}/avatar.png`,
      });

      await service.updateAvatar(MOCK_USER.id, Buffer.from('new-img'), 'pic.png');

      expect(photoStorage.delete).toHaveBeenCalledWith(
        'http://localhost:3000/uploads/users/old-avatar.jpg',
      );
    });

    it('should use a distinct storage key on each upload so a replacement never overwrites the previous file', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      photoStorage.upload.mockImplementation((_file: Buffer, key: string) =>
        Promise.resolve({ key, url: `http://localhost:3000/uploads/${key}`, thumbnailUrl: null }),
      );
      prisma.user.update.mockResolvedValue(MOCK_USER);

      await service.updateAvatar(MOCK_USER.id, Buffer.from('img-1'), 'avatar.jpg');
      await service.updateAvatar(MOCK_USER.id, Buffer.from('img-2'), 'avatar.jpg');

      const [firstKey, secondKey] = photoStorage.upload.mock.calls.map(([, key]) => key);
      expect(firstKey).not.toBe(secondKey);
    });

    it('should not delete old avatar if none exists', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER); // profilePicture = null
      photoStorage.upload.mockResolvedValue({
        key: `users/${MOCK_USER.id}/avatar.jpg`,
        url: `http://localhost:3000/uploads/users/${MOCK_USER.id}/avatar.jpg`,
        thumbnailUrl: null,
      });
      prisma.user.update.mockResolvedValue(MOCK_USER);

      await service.updateAvatar(MOCK_USER.id, Buffer.from('img'), 'pic.jpg');

      expect(photoStorage.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAvatar(MOCK_USER.id, Buffer.from('img'), 'pic.jpg'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ status: HttpStatus.NOT_FOUND }),
      });
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar from storage and set profilePicture to null', async () => {
      const userWithAvatar = {
        ...MOCK_USER,
        profilePicture: 'http://localhost:3000/uploads/users/avatar.jpg',
      };
      prisma.user.findUnique.mockResolvedValue(userWithAvatar);
      prisma.user.update.mockResolvedValue({ ...MOCK_USER, profilePicture: null });

      await service.deleteAvatar(MOCK_USER.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: { profilePicture: null },
      });
      expect(photoStorage.delete).toHaveBeenCalledWith(
        'http://localhost:3000/uploads/users/avatar.jpg',
      );
    });

    it('should do nothing if user has no avatar', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER); // profilePicture = null

      await service.deleteAvatar(MOCK_USER.id);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(photoStorage.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAvatar(MOCK_USER.id)).rejects.toMatchObject({
        response: expect.objectContaining({ status: HttpStatus.NOT_FOUND }),
      });
    });
  });
});
