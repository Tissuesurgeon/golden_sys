import { redirect } from "next/navigation";
import { PageHeader, StatusBadge, Surface, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";

const studentLabel: Record<string, string> = {
  active: "Enrolled",
  pending: "Pending",
  transferred: "Transferred",
  withdrawn: "Withdrawn",
  graduated: "Graduated",
};

function classRank(name: string) {
  if (name.startsWith("KG")) return 0;
  if (name.startsWith("Basic")) return 1;
  if (name.startsWith("JHS")) return 2;
  return 3;
}

export default async function ReportsPage() {
  const user = await requireUser();
  const finance = can(user.role, "reports.finance");
  const academic = can(user.role, "reports.academic");
  if (!finance && !academic) redirect("/dashboard");
  const [applications, students, invoices, payments, sheets, classes] = await Promise.all([
    finance ? prisma.admissionApplication.groupBy({ by: ["status"], _count: true }) : Promise.resolve([]),
    prisma.student.groupBy({ by: ["status"], _count: true }),
    finance
      ? prisma.invoice.findMany({
          where: { status: { notIn: ["cancelled", "reversed"] } },
          include: { items: true, allocations: { include: { payment: true } }, adjustments: true },
        })
      : Promise.resolve([]),
    finance ? prisma.payment.aggregate({ where: { reversedAt: null }, _sum: { amount: true } }) : Promise.resolve(null),
    academic ? prisma.markSheet.groupBy({ by: ["status"], _count: true }) : Promise.resolve([]),
    prisma.classRoom.findMany({ include: { enrollments: { where: { active: true } } } }),
  ]);
  const charged = invoices.reduce((sum, invoice) => sum + invoice.items.reduce((inner, item) => inner + item.amount, 0), 0);
  const adjusted = invoices.reduce(
    (sum, invoice) => sum + invoice.adjustments.filter((item) => !item.reversedAt).reduce((inner, item) => inner + item.amount, 0),
    0,
  );
  const allocated = invoices.reduce(
    (sum, invoice) => sum + invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((inner, item) => inner + item.amount, 0),
    0,
  );
  const open = charged + adjusted - allocated;
  const rooms = [...classes].sort((a, b) => classRank(a.name) - classRank(b.name) || a.name.localeCompare(b.name));
  const admissionOrder = ["submitted", "under_review", "accepted", "enrolled", "waitlisted", "deferred", "rejected", "draft"];

  return (
    <div>
      <PageHeader
        title="Reports"
        description={
          finance && academic
            ? "Counts and balances from the admission list, the fee ledger, and mark sheets."
            : finance
              ? "Counts and balances from the admission list and the fee ledger."
              : "Class sizes and mark-sheet progress."
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {finance ? (
          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">Admissions</h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {[...applications]
                .sort((a, b) => admissionOrder.indexOf(a.status) - admissionOrder.indexOf(b.status))
                .map((row) => (
                  <li key={row.status} className="flex items-center justify-between py-2">
                    <span className="capitalize">{row.status.replaceAll("_", " ")}</span>
                    <span className="font-medium tabular-nums text-ink">{row._count}</span>
                  </li>
                ))}
            </ul>
            <h2 className="mt-6 text-lg font-semibold text-navy">Ledger</h2>
            <dl className="mt-3 divide-y divide-border text-sm">
              <div className="flex justify-between py-2"><dt>Invoiced</dt><dd className="font-medium tabular-nums">{formatMoney(charged)}</dd></div>
              <div className="flex justify-between py-2"><dt>Allocated to invoices</dt><dd className="font-medium tabular-nums">{formatMoney(allocated)}</dd></div>
              <div className="flex justify-between py-2"><dt>Still open</dt><dd className="font-medium tabular-nums">{formatMoney(open)}</dd></div>
              <div className="flex justify-between py-2"><dt>Payments recorded</dt><dd className="font-medium tabular-nums">{formatMoney(payments?._sum.amount ?? 0)}</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Payments are recorded by the school. An amount larger than the invoice stays as credit on the receipt.</p>
          </Surface>
        ) : null}
        <Surface className="p-5">
          <h2 className="text-lg font-semibold text-navy">Students by class</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {rooms.map((room) => (
              <li key={room.id} className="flex items-center justify-between py-2">
                <span>{room.name}</span>
                <span className="font-medium tabular-nums text-ink">{room.enrollments.length}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-2">
            {students.map((row) => (
              <li key={row.status}>
                <StatusBadge tone={row.status === "active" ? "success" : row.status === "withdrawn" ? "warning" : "neutral"}>
                  {studentLabel[row.status] ?? row.status} · {row._count}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Surface>
        {academic ? (
          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">Mark sheets</h2>
            <ul className="mt-3 space-y-2">
              {sheets.map((row) => (
                <li key={row.status} className="flex items-center justify-between text-sm">
                  <StatusBadge tone={sheetStatusTone(row.status)}>{sheetStatusLabel(row.status)}</StatusBadge>
                  <span className="font-medium tabular-nums text-ink">{row._count}</span>
                </li>
              ))}
            </ul>
          </Surface>
        ) : null}
      </div>
    </div>
  );
}
