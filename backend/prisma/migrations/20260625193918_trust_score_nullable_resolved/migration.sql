-- trustScore becomes nullable: null = "not yet rated" (no resolved loan).
-- The score is now computed over resolved loans only
-- (returned_on_time + returned_late + not_returned), excluding CONTESTED and
-- in-progress loans.

-- AlterTable
ALTER TABLE "borrowers" ALTER COLUMN "trust_score" DROP NOT NULL,
ALTER COLUMN "trust_score" DROP DEFAULT;
