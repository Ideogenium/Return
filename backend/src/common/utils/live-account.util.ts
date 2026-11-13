import type { Prisma, PrismaClient } from '@prisma/client';
import { UnauthorizedException } from '../exceptions/problem-details.exception.js';

// =============================================================================
// Live account checks (FIX-22, security review C1/C2)
// =============================================================================
// A deleted account kept as a tombstone still has its `users` row. Its access tokens are
// revoked in Redis at deletion, but writes that create data on its behalf (items, contacts,
// photos, loans) also check the row itself: defense in depth, and the loan creation locks it
// so that it cannot interleave with a deletion in progress.
// =============================================================================

function deletedAccountAccess(path: string): UnauthorizedException {
  // Same answer as a revoked token: the account behind it no longer exists.
  return new UnauthorizedException(
    'invalid-token',
    'Invalid Token',
    'The provided token is invalid or has expired.',
    path,
  );
}

/** Refuses with 401 invalid-token unless the account exists and is not deleted. */
export async function assertLiveAccount(
  client: Pick<PrismaClient, 'user'> | Prisma.TransactionClient,
  userId: string,
  path: string,
): Promise<void> {
  const live = await client.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!live) throw deletedAccountAccess(path);
}

/**
 * Same check inside a transaction, with a shared lock on the account row: a deletion in
 * progress (FOR UPDATE) is waited for, and once it is committed the account is refused.
 */
export async function lockLiveAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  path: string,
): Promise<void> {
  const live = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL FOR SHARE`;
  if (live.length === 0) throw deletedAccountAccess(path);
}
