import type { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { JwtStrategy, type JwtPayload } from './jwt.strategy.js';
import type { RedisService } from '../../redis/redis.service.js';
import type { ProblemDetails } from '../../common/exceptions/problem-details.exception.js';

const PAYLOAD: JwtPayload = {
  sub: 'user-1',
  email: 'john@example.com',
  role: 'LENDER',
  jti: 'jti-1',
  exp: 1_900_000_000,
};

describe('JwtStrategy.validate', () => {
  let redis: { isAccessRevoked: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    redis = { isAccessRevoked: jest.fn().mockResolvedValue(false) };
    const config = { getOrThrow: () => 'test-secret' } as unknown as ConfigService;
    strategy = new JwtStrategy(config, redis as unknown as RedisService);
  });

  it('checks the token and the account in a single revocation lookup', async () => {
    await expect(strategy.validate(PAYLOAD)).resolves.toEqual({
      userId: 'user-1',
      email: 'john@example.com',
      role: 'LENDER',
      jti: 'jti-1',
      tokenExp: 1_900_000_000,
    });
    expect(redis.isAccessRevoked).toHaveBeenCalledWith('jti-1', 'user-1');
  });

  it('answers 401 invalid-token once the access is revoked (logout or deleted account)', async () => {
    redis.isAccessRevoked.mockResolvedValue(true);

    const error = (await strategy.validate(PAYLOAD).catch((e: unknown) => e)) as {
      getStatus: () => number;
      getResponse: () => ProblemDetails;
    };

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse().type).toBe('https://api.return.app/errors/invalid-token');
  });

  it('fails the request when Redis cannot answer, rather than letting the token through', async () => {
    redis.isAccessRevoked.mockRejectedValue(new Error('Redis down'));

    await expect(strategy.validate(PAYLOAD)).rejects.toThrow('Redis down');
  });
});
