-- A cancelled or reversed invoice must not block a new bill for the same student and term.
DROP INDEX IF EXISTS "Invoice_studentId_termId_kind_key";

CREATE UNIQUE INDEX "Invoice_active_student_term_kind_key"
ON "Invoice" ("studentId", "termId", "kind")
WHERE "status" NOT IN ('cancelled', 'reversed');

DELETE FROM "InvoiceItem" WHERE "label" = 'Arrears brought forward';

UPDATE "Invoice" SET "carriedToInvoiceId" = NULL WHERE "carriedToInvoiceId" IS NOT NULL;

UPDATE "Invoice" AS invoice
SET "status" = computed.status
FROM (
  SELECT source.id,
    CASE
      WHEN COALESCE(paid.amount, 0) <= 0 THEN 'issued'::"InvoiceStatus"
      WHEN COALESCE(paid.amount, 0) >= COALESCE(charges.amount, 0) + COALESCE(adjusted.amount, 0) THEN 'paid'::"InvoiceStatus"
      ELSE 'partial'::"InvoiceStatus"
    END AS status
  FROM "Invoice" AS source
  LEFT JOIN (
    SELECT "invoiceId", SUM(amount) AS amount FROM "InvoiceItem" GROUP BY "invoiceId"
  ) AS charges ON charges."invoiceId" = source.id
  LEFT JOIN (
    SELECT "invoiceId", SUM(amount) AS amount FROM "Adjustment" WHERE "reversedAt" IS NULL GROUP BY "invoiceId"
  ) AS adjusted ON adjusted."invoiceId" = source.id
  LEFT JOIN (
    SELECT allocation."invoiceId", SUM(allocation.amount) AS amount
    FROM "PaymentAllocation" AS allocation
    JOIN "Payment" AS payment ON payment.id = allocation."paymentId"
    WHERE payment."reversedAt" IS NULL
    GROUP BY allocation."invoiceId"
  ) AS paid ON paid."invoiceId" = source.id
  WHERE source.status = 'carried_forward'
) AS computed
WHERE invoice.id = computed.id;
