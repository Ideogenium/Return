import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { TrustScoreService } from '../trust-score/trust-score.service.js';
import { UserRole } from '@prisma/client';
import type { SafeUser, UserSettings } from '../auth/interfaces/auth-response.interface.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

// =============================================================================
// Fixtures
// =============================================================================

const MOCK_SAFE_USER: SafeUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.LENDER,
  profilePicture: null,
  settings: {
    pushNotificationsEnabled: true,
    reminderEnabled: true,
    language: 'fr',
    timezone: 'Europe/Paris',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

const MOCK_SETTINGS: UserSettings = {
  pushNotificationsEnabled: true,
  reminderEnabled: true,
  language: 'fr',
  timezone: 'Europe/Paris',
};

const MOCK_AUTH_USER: AuthenticatedUser = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'john@example.com',
  role: 'LENDER',
  jti: 'mock-jti',
  tokenExp: Math.floor(Date.now() / 1000) + 600,
};

const mockRequest = { user: MOCK_AUTH_USER };

// =============================================================================
// Test Suite
// =============================================================================

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    deleteAccount: jest.Mock;
    changePassword: jest.Mock;
    getSettings: jest.Mock;
    updateSettings: jest.Mock;
    updateAvatar: jest.Mock;
  };
  let trustScoreService: { computeGlobalTrustScore: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      getProfile: jest.fn().mockResolvedValue(MOCK_SAFE_USER),
      updateProfile: jest.fn().mockResolvedValue(MOCK_SAFE_USER),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
      changePassword: jest.fn().mockResolvedValue(undefined),
      getSettings: jest.fn().mockResolvedValue(MOCK_SETTINGS),
      updateSettings: jest.fn().mockResolvedValue(MOCK_SETTINGS),
      updateAvatar: jest.fn(),
    };
    trustScoreService = { computeGlobalTrustScore: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: TrustScoreService, useValue: trustScoreService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  // ===========================================================================
  // GET /users/me
  // ===========================================================================

  describe('getProfile', () => {
    it('should delegate to UsersService.getProfile with userId from JWT', async () => {
      const result = await controller.getProfile(mockRequest);

      expect(usersService.getProfile).toHaveBeenCalledWith(MOCK_AUTH_USER.userId);
      expect(result).toEqual(MOCK_SAFE_USER);
    });
  });

  describe('getMyTrustScore', () => {
    it('should delegate to TrustScoreService with userId from JWT (FIX-15)', async () => {
      const score = {
        trustScore: 80,
        totalLoans: 10,
        returnedOnTime: 7,
        returnedLate: 2,
        notReturned: 1,
      };
      trustScoreService.computeGlobalTrustScore.mockResolvedValue(score);

      const result = await controller.getMyTrustScore(mockRequest);

      expect(trustScoreService.computeGlobalTrustScore).toHaveBeenCalledWith(MOCK_AUTH_USER.userId);
      expect(result).toEqual(score);
    });
  });

  // ===========================================================================
  // PATCH /users/me
  // ===========================================================================

  describe('updateProfile', () => {
    it('should delegate to UsersService.updateProfile', async () => {
      const dto = { firstName: 'Jane' };

      const result = await controller.updateProfile(mockRequest, dto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(MOCK_AUTH_USER.userId, dto);
      expect(result).toEqual(MOCK_SAFE_USER);
    });
  });

  // ===========================================================================
  // DELETE /users/me
  // ===========================================================================

  describe('deleteAccount', () => {
    it('should delegate to UsersService.deleteAccount and return void', async () => {
      const dto = {
        password: 'StrongPass1!',
        confirmationText: 'DELETE MY ACCOUNT' as const,
      };

      const result = await controller.deleteAccount(mockRequest, dto);

      expect(usersService.deleteAccount).toHaveBeenCalledWith(MOCK_AUTH_USER.userId, dto);
      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // PATCH /users/me/password
  // ===========================================================================

  describe('changePassword', () => {
    it('should delegate to UsersService.changePassword with jti/tokenExp and return void', async () => {
      const dto = {
        currentPassword: 'StrongPass1!',
        newPassword: 'NewPass1!',
      };

      const result = await controller.changePassword(mockRequest, dto);

      expect(usersService.changePassword).toHaveBeenCalledWith(
        MOCK_AUTH_USER.userId,
        dto,
        MOCK_AUTH_USER.jti,
        MOCK_AUTH_USER.tokenExp,
      );
      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // GET /users/me/settings
  // ===========================================================================

  describe('getSettings', () => {
    it('should return user settings', async () => {
      const result = await controller.getSettings(mockRequest);

      expect(usersService.getSettings).toHaveBeenCalledWith(MOCK_AUTH_USER.userId);
      expect(result).toEqual(MOCK_SETTINGS);
    });
  });

  // ===========================================================================
  // PATCH /users/me/settings
  // ===========================================================================

  describe('updateSettings', () => {
    it('should delegate to UsersService.updateSettings', async () => {
      const dto = { language: 'en' };

      const result = await controller.updateSettings(mockRequest, dto);

      expect(usersService.updateSettings).toHaveBeenCalledWith(MOCK_AUTH_USER.userId, dto);
      expect(result).toEqual(MOCK_SETTINGS);
    });
  });

  // ===========================================================================
  // PUT /users/me/avatar
  // ===========================================================================

  describe('updateAvatar', () => {
    it('should delegate to UsersService.updateAvatar', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-image'),
        originalname: 'avatar.jpg',
      };
      const mockAvatarResponse = {
        profilePicture: 'http://localhost:3000/uploads/users/test/avatar.jpg',
      };
      usersService.updateAvatar.mockResolvedValue(mockAvatarResponse);

      const result = await controller.updateAvatar(mockRequest, mockFile as never);

      expect(usersService.updateAvatar).toHaveBeenCalledWith(
        MOCK_AUTH_USER.userId,
        mockFile.buffer,
        'avatar.jpg',
      );
      expect(result).toEqual(mockAvatarResponse);
    });
  });
});
