import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthService } from './auth.service.js';
import { USER_EVENTS } from '../common/events/user.events.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserRole } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import type { ProblemDetails } from '../common/exceptions/problem-details.exception.js';

// =============================================================================
// Mocks — bcrypt est mocké au niveau module pour contrôler le hachage
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
// Fixtures — Données de test réutilisables
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
  deletedAt: null,
};

const REGISTER_DTO: RegisterDto = {
  email: 'john@example.com',
  password: 'StrongPass1!',
  firstName: 'John',
  lastName: 'Doe',
};

const LOGIN_DTO: LoginDto = {
  email: 'john@example.com',
  password: 'StrongPass1!',
};

// =============================================================================
// Test Suite
// =============================================================================

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let redisService: {
    blacklistToken: jest.Mock;
    isTokenBlacklisted: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    // Reset tous les mocks entre chaque test pour éviter les effets de bord
    jest.clearAllMocks();

    prisma = mockDeep<PrismaService>();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock.access.token'),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_EXPIRATION: '15m',
          JWT_REFRESH_EXPIRATION: '30d',
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
        };
        if (!values[key]) throw new Error(`Missing ${key}`);
        return values[key];
      }),
    };
    redisService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: RedisService, useValue: redisService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ===========================================================================
  // REGISTER
  // ===========================================================================

  describe('register', () => {
    beforeEach(() => {
      // Par défaut : bcrypt.hash retourne un hash cohérent
      bcrypt.hash.mockResolvedValue('$2b$12$hashedPasswordValue');
      // Prisma crée l'utilisateur avec succès
      prisma.user.create.mockResolvedValue(MOCK_USER);
      // Prisma crée le refresh token
      prisma.refreshToken.create.mockResolvedValue({
        id: 'rt-uuid',
        token: 'hashed-refresh-token',
        userId: MOCK_USER.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
    });

    it('should hash the password with bcrypt 12 rounds before storing', async () => {
      // Act
      await service.register(REGISTER_DTO);

      // Assert — bcrypt.hash appelé avec le mot de passe brut et 12 rounds (ADR-004)
      expect(bcrypt.hash).toHaveBeenCalledWith(REGISTER_DTO.password, 12);
    });

    it('should create the user in database with hashed password', async () => {
      // Act
      await service.register(REGISTER_DTO);

      // Assert — Prisma reçoit le hash, pas le mot de passe brut
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: REGISTER_DTO.email,
          password: '$2b$12$hashedPasswordValue',
          firstName: REGISTER_DTO.firstName,
          lastName: REGISTER_DTO.lastName,
        }),
      });
    });

    it('should generate a JWT access token with sub, email, role, and jti claims', async () => {
      // Act
      await service.register(REGISTER_DTO);

      // Assert — Le JWT contient les claims nécessaires (jti pour la blacklist, role pour éviter un appel DB)
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: MOCK_USER.id,
          email: MOCK_USER.email,
          role: MOCK_USER.role,
          jti: expect.any(String),
        }),
      );
    });

    it('should store a SHA-256 hashed refresh token in database', async () => {
      // Act
      await service.register(REGISTER_DTO);

      // Assert — Le refresh token stocké est un hash SHA-256 (64 chars hex)
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.stringMatching(/^[a-f0-9]{64}$/),
          userId: MOCK_USER.id,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should return a complete AuthResponse with user data (no password)', async () => {
      // Act
      const result = await service.register(REGISTER_DTO);

      // Assert — Structure AuthResponse conforme au schéma OpenAPI
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'mock.access.token',
          refreshToken: expect.any(String),
          expiresIn: 900, // 15 min en secondes
          tokenType: 'Bearer',
          user: expect.objectContaining({
            id: MOCK_USER.id,
            email: MOCK_USER.email,
            firstName: MOCK_USER.firstName,
            lastName: MOCK_USER.lastName,
            role: UserRole.LENDER,
            settings: expect.objectContaining({
              pushNotificationsEnabled: true,
              reminderEnabled: true,
              language: 'fr',
              timezone: 'Europe/Paris',
            }),
          }),
        }),
      );
      // Le password ne doit JAMAIS fuiter dans la réponse
      expect(result.user).not.toHaveProperty('password');
      // updatedAt ne fait pas partie du schéma OpenAPI User
      expect(result.user).not.toHaveProperty('updatedAt');
    });

    it('should throw ConflictException (409) if email already exists', async () => {
      // Arrange — Simuler une violation de contrainte unique Prisma
      const prismaError = new Error('Unique constraint failed') as Error & {
        code: string;
        meta: { target: string[] };
      };
      prismaError.code = 'P2002';
      prismaError.meta = { target: ['email'] };
      prisma.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      try {
        await service.register(REGISTER_DTO);
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

    it('should emit user.registered event with userId and email', async () => {
      // Act
      await service.register(REGISTER_DTO);

      // Assert — Événement métier émis pour découplage inter-modules (OCP)
      expect(eventEmitter.emit).toHaveBeenCalledWith(USER_EVENTS.REGISTERED, {
        userId: MOCK_USER.id,
        email: MOCK_USER.email,
      });
    });
  });

  // ===========================================================================
  // LOGIN
  // ===========================================================================

  describe('login', () => {
    const UPDATED_USER = {
      ...MOCK_USER,
      lastLoginAt: new Date(),
    };

    beforeEach(() => {
      // Par défaut : l'utilisateur existe et le mot de passe est correct
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      bcrypt.compare.mockResolvedValue(true);
      // update retourne l'utilisateur avec lastLoginAt mis à jour
      prisma.user.update.mockResolvedValue(UPDATED_USER);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'rt-uuid',
        token: 'hashed-refresh-token',
        userId: MOCK_USER.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
    });

    it('answers a deleted account exactly like an unknown one, without checking the password (FIX-22)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, deletedAt: new Date() });

      const error = (await service.login(LOGIN_DTO).catch((e: unknown) => e)) as {
        getStatus: () => number;
        getResponse: () => ProblemDetails;
      };

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          type: 'https://api.return.app/errors/invalid-credentials',
          detail: 'Email or password is incorrect.',
        }),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should return AuthResponse for valid credentials', async () => {
      // Act
      const result = await service.login(LOGIN_DTO);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'mock.access.token',
          refreshToken: expect.any(String),
          expiresIn: 900,
          tokenType: 'Bearer',
          user: expect.objectContaining({
            id: MOCK_USER.id,
            email: MOCK_USER.email,
          }),
        }),
      );
    });

    it('should verify password with bcrypt.compare', async () => {
      // Act
      await service.login(LOGIN_DTO);

      // Assert — Compare le mot de passe brut avec le hash stocké
      expect(bcrypt.compare).toHaveBeenCalledWith(LOGIN_DTO.password, MOCK_USER.password);
    });

    it('should throw UnauthorizedException (401) for non-existent email', async () => {
      // Arrange — Aucun utilisateur trouvé
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert — Message générique pour ne pas révéler l'existence du compte
      try {
        await service.login(LOGIN_DTO);
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

        const body = exception.getResponse();
        expect(body.type).toContain('invalid-credentials');
      }
    });

    it('should throw UnauthorizedException (401) for wrong password', async () => {
      // Arrange — Mot de passe incorrect
      bcrypt.compare.mockResolvedValue(false);

      // Act & Assert — Même message que email inexistant (sécurité)
      try {
        await service.login(LOGIN_DTO);
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

        const body = exception.getResponse();
        expect(body.type).toContain('invalid-credentials');
      }
    });

    it('should update lastLoginAt timestamp', async () => {
      // Act
      await service.login(LOGIN_DTO);

      // Assert — lastLoginAt mis à jour avec la date actuelle
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should emit user.logged-in event with userId', async () => {
      // Act
      await service.login(LOGIN_DTO);

      // Assert — Événement métier émis pour découplage inter-modules (OCP)
      expect(eventEmitter.emit).toHaveBeenCalledWith(USER_EVENTS.LOGGED_IN, {
        userId: MOCK_USER.id,
      });
    });
  });

  // ===========================================================================
  // REFRESH
  // ===========================================================================

  describe('refreshTokens', () => {
    const RAW_REFRESH_TOKEN = 'a'.repeat(64);

    beforeEach(() => {
      // Par défaut : le refresh token existe et n'est pas expiré
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-uuid',
        token: expect.any(String),
        userId: MOCK_USER.id,
        expiresAt: new Date(Date.now() + 86_400_000), // expire dans 24h
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      prisma.refreshToken.delete.mockResolvedValue({} as never);
      prisma.refreshToken.create.mockResolvedValue({
        id: 'new-rt-uuid',
        token: 'new-hashed-token',
        userId: MOCK_USER.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
    });

    it('should return new tokens for a valid refresh token', async () => {
      // Act
      const result = await service.refreshTokens(RAW_REFRESH_TOKEN);

      // Assert — Nouveaux access + refresh tokens (rotation)
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'mock.access.token',
          refreshToken: expect.any(String),
          expiresIn: 900,
          tokenType: 'Bearer',
          user: expect.objectContaining({ id: MOCK_USER.id }),
        }),
      );
    });

    it('refuses a refresh token of a deleted account and issues no new token (FIX-22)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, deletedAt: new Date() });

      const error = (await service.refreshTokens(RAW_REFRESH_TOKEN).catch((e: unknown) => e)) as {
        getStatus: () => number;
        getResponse: () => ProblemDetails;
      };

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.getResponse().type).toContain('invalid-refresh-token');
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unknown refresh token', async () => {
      // Arrange — Token introuvable en base
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.refreshTokens('invalid-token');
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

        const body = exception.getResponse();
        expect(body.type).toContain('invalid-refresh-token');
      }
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      // Arrange — Token expiré
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-uuid',
        token: 'hash',
        userId: MOCK_USER.id,
        expiresAt: new Date(Date.now() - 1000), // expiré il y a 1 seconde
        createdAt: new Date(),
      });

      // Act & Assert
      try {
        await service.refreshTokens(RAW_REFRESH_TOKEN);
        fail('Should have thrown');
      } catch (error) {
        const exception = error as {
          getStatus: () => number;
          getResponse: () => ProblemDetails;
        };
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it('should delete the expired token from database when detected', async () => {
      // Arrange
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-uuid',
        token: 'hash',
        userId: MOCK_USER.id,
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });

      // Act & Assert
      try {
        await service.refreshTokens(RAW_REFRESH_TOKEN);
      } catch {
        // Expected
      }

      // Le token expiré est nettoyé de la base
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-uuid' },
      });
    });

    it('should perform token rotation (delete old, create new)', async () => {
      // Act
      await service.refreshTokens(RAW_REFRESH_TOKEN);

      // Assert — L'ancien token est supprimé, un nouveau est créé
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-uuid' },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.stringMatching(/^[a-f0-9]{64}$/),
          userId: MOCK_USER.id,
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  // ===========================================================================
  // LOGOUT
  // ===========================================================================

  describe('logout', () => {
    const JTI = 'mock-jti-uuid';
    const TOKEN_EXP = Math.floor(Date.now() / 1000) + 600; // expire dans 10 min

    it('should blacklist the access token jti in Redis with remaining TTL', async () => {
      // Act
      await service.logout(MOCK_USER.id, JTI, TOKEN_EXP);

      // Assert — Le jti est blacklisté avec un TTL ≈ 600 secondes
      expect(redisService.blacklistToken).toHaveBeenCalledWith(JTI, expect.any(Number));
      // Le TTL doit être positif et proche de 600
      const ttl = redisService.blacklistToken.mock.calls[0][1] as number;
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('should skip blacklisting if token is already expired', async () => {
      // Arrange — Token déjà expiré
      const expiredExp = Math.floor(Date.now() / 1000) - 10;

      // Act
      await service.logout(MOCK_USER.id, JTI, expiredExp);

      // Assert — Pas de blacklist si le token est déjà expiré (inutile)
      expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should delete ALL refresh tokens for the user from database', async () => {
      // Act
      await service.logout(MOCK_USER.id, JTI, TOKEN_EXP);

      // Assert — Tous les refresh tokens de l'utilisateur sont supprimés
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER.id },
      });
    });
  });
});
