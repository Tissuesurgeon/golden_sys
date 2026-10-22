import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      before: entry.before,
      after: entry.after,
    },
  });
}

export async function nextNumber(tx: Prisma.TransactionClient, key: string, prefix: string) {
  const row = await tx.counter.upsert({
    where: { id: key },
    create: { id: key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}${String(row.value).padStart(5, "0")}`;
}
