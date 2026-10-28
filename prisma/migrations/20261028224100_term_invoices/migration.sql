-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'carried_forward';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "carriedToInvoiceId" TEXT,
ADD COLUMN     "dueOn" DATE,
ADD COLUMN     "termId" TEXT;

-- Backfill term links from the label already stored on each invoice.
UPDATE "Invoice" AS i
SET "termId" = t.id
FROM "Term" AS t
WHERE i."yearId" = t."yearId" AND i."termLabel" = t.label AND i."termId" IS NULL;

-- AlterTable
ALTER TABLE "SchoolSettings" ADD COLUMN     "invoiceDueDays" INTEGER NOT NULL DEFAULT 14;

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "feeItemId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeSchedule_classId_idx" ON "FeeSchedule"("classId");

-- CreateIndex
CREATE INDEX "FeeSchedule_termId_idx" ON "FeeSchedule"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeSchedule_feeItemId_classId_termId_key" ON "FeeSchedule"("feeItemId", "classId", "termId");

-- CreateIndex
CREATE INDEX "Invoice_termId_idx" ON "Invoice"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_studentId_termId_kind_key" ON "Invoice"("studentId", "termId", "kind");

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_carriedToInvoiceId_fkey" FOREIGN KEY ("carriedToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
