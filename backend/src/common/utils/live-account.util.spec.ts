import { HttpStatus } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertLiveAccount, lockLiveAccount } from './live-account.util.js';
import type { ProblemDetails } from '../exceptions/problem-details.exception.js';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function asProblem(error: unknown) {
  return error as { getStatus: () => number; getResponse: () => ProblemDetails };
}

describe('assertLiveAccount', () => {
  it('lets a live account through', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID } as never);

    await expect(assertLiveAccount(prisma, USER_ID, '/v1/items')).resolves.toBeUndefined();
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_ID, deletedAt: null },
      select: { id: true },
    });
  });

  it('answers 401 invalid-token for a deleted account still holding an access token', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.findFirst.mockResolvedValue(null);

    const error = asProblem(
      await assertLiveAccount(prisma, USER_ID, '/v1/items').catch((e: unknown) => e),
    );

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse().type).toBe('https://api.return.app/errors/invalid-token');
    expect(error.getResponse().instance).toBe('/v1/items');
  });
});

describe('lockLiveAccount', () => {
  it('takes a shared lock on the live account row, so a deletion in progress is waited for', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();
    tx.$queryRaw.mockResolvedValue([{ id: USER_ID }] as never);

    await expect(lockLiveAccount(tx, USER_ID, '/v1/loans')).resolves.toBeUndefined();

    const [sql] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
    expect(sql.join('?')).toMatch(/deleted_at IS NULL/);
    expect(sql.join('?')).toMatch(/FOR SHARE/);
  });

  it('answers 401 invalid-token when the account is deleted', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();
    tx.$queryRaw.mockResolvedValue([] as never);

    const error = asProblem(
      await lockLiveAccount(tx, USER_ID, '/v1/loans').catch((e: unknown) => e),
    );

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse().type).toBe('https://api.return.app/errors/invalid-token');
  });
});
