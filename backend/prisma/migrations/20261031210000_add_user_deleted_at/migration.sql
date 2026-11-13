-- FIX-22 (ADR 0010): a deleted account that still lends closed loans visible to a
-- borrower is kept as a pseudonymised tombstone, marked by deleted_at. Nullable,
-- no default: existing rows are untouched.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
