-- FIX-22 (ADR 0010, security review C4): set when the account a contact represented is
-- deleted. The contact is then detached for good (non-routable email, phone erased) and never
-- relinked. Nullable, no default: existing rows are untouched.

-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN "account_deleted_at" TIMESTAMP(3);
