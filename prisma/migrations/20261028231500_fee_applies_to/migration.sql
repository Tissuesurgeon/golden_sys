-- CreateEnum
CREATE TYPE "FeeAppliesTo" AS ENUM ('new', 'returning', 'all');

-- AlterTable
ALTER TABLE "FeeItem" ADD COLUMN "appliesTo" "FeeAppliesTo" NOT NULL DEFAULT 'all';

-- Admission and registration fees apply to a student's first term.
UPDATE "FeeItem" SET "appliesTo" = 'new' WHERE "kind" = 'admission';
