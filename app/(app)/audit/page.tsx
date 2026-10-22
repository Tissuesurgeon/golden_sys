import { redirect } from "next/navigation";
import { AuditLog, type AuditRow } from "@/components/audit/audit-log";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user.role, "audit.read")) redirect("/dashboard");
  const records = await prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const rows: AuditRow[] = records.map((row) => ({
    id: row.id,
    at: row.createdAt.toISOString(),
    actor: row.actor?.name ?? "System",
    action: row.action,
    summary: row.summary,
  }));
  return <AuditLog rows={rows} />;
}
