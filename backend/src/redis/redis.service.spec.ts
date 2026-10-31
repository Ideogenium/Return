import type { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service.js';

// The client is created with lazyConnect: spying on its commands never opens a connection.
function createService(): RedisService {
  const config = { getOrThrow: () => 'redis://localhost:6399' } as unknown as ConfigService;
  return new RedisService(config);
}

describe('RedisService — access revocation (FIX-22)', () => {
  let service: RedisService;

  beforeEach(() => {
    service = createService();
  });

  afterEach(() => {
    service.getClient().disconnect();
  });

  it('marks a deleted account for the given number of seconds', async () => {
    const setex = jest.spyOn(service.getClient(), 'setex').mockResolvedValue('OK');

    await service.markAccountDeleted('user-1', 900);

    expect(setex).toHaveBeenCalledWith('user-deleted:user-1', 900, '1');
  });

  it('reads the token blacklist and the deleted-account mark in one round trip', async () => {
    const mget = jest.spyOn(service.getClient(), 'mget').mockResolvedValue([null, null]);

    await expect(service.isAccessRevoked('jti-1', 'user-1')).resolves.toBe(false);
    expect(mget).toHaveBeenCalledWith('bl:jti-1', 'user-deleted:user-1');
  });

  it.each([
    ['the token is blacklisted (logout)', ['1', null]],
    ['the account was deleted', [null, '1']],
  ])('revokes the access when %s', async (_case, values) => {
    jest.spyOn(service.getClient(), 'mget').mockResolvedValue(values);

    await expect(service.isAccessRevoked('jti-1', 'user-1')).resolves.toBe(true);
  });

  it('lets a Redis error reach the caller, so a request is never let through on doubt', async () => {
    jest.spyOn(service.getClient(), 'mget').mockRejectedValue(new Error('Redis down'));

    await expect(service.isAccessRevoked('jti-1', 'user-1')).rejects.toThrow('Redis down');
  });
});
