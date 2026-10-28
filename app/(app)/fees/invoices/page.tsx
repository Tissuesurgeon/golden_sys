import Link from "next/link";
import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { displayInvoiceStatus, invoiceBalance } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { requireFinance } from "@/lib/server/guard";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string; classId?: string; status?: string; q?: string; created?: string; skipped?: string }>;
}) {
  await requireFinance();
  const query = await searchParams;
  const [years, classes, invoices] = await Promise.all([
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: {
        kind: "school_fee",
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.status ? { status: query.status as InvoiceStatus } : {}),
      },
      include: {
        student: { include: { enrollments: { where: { active: true }, include: { classRoom: true } } } },
        items: true,
        adjustments: true,
        allocations: { include: { payment: true } },
        term: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const needle = (query.q || "").trim().toLowerCase();
  const rows = invoices.filter((invoice) => {
    const room = invoice.student?.enrollments[0]?.classRoom;
    if (query.classId && room?.id !== query.classId) return false;
    if (!needle) return true;
    const name = `${invoice.student?.firstName ?? ""} ${invoice.student?.lastName ?? ""} ${invoice.number}`.toLowerCase();
    return name.includes(needle);
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Term bills, arrears carried forward, and what is still open."
        actions={<LinkButton href="/fees/invoices/generate">Generate term invoices</LinkButton>}
      />
      {query.created ? <p className="mb-4 text-sm text-navy">Created {query.created}. Skipped {query.skipped ?? 0} students who already had this term invoice.</p> : null}
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 sm:grid-cols-5">
          <select className={selectClassName()} name="termId" defaultValue={query.termId || ""} aria-label="Term">
            <option value="">All terms</option>
            {years.flatMap((year) => year.terms.map((term) => <option key={term.id} value={term.id}>{year.label} {term.label}</option>))}
          </select>
          <select className={selectClassName()} name="classId" defaultValue={query.classId || ""} aria-label="Class">
            <option value="">All classes</option>
            {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <select className={selectClassName()} name="status" defaultValue={query.status || ""} aria-label="Status">
            <option value="">All statuses</option>
            {["issued", "partial", "paid", "overdue", "carried_forward", "cancelled"].map((status) => <option key={status}>{status}</option>)}
          </select>
          <Input name="q" defaultValue={query.q || ""} placeholder="Search student or number" aria-label="Search invoices" />
          <Button type="submit" variant="outline">Filter</Button>
        </form>
      </Surface>
      <Surface className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => {
              const balance = invoiceBalance(invoice);
              const status = displayInvoiceStatus(invoice, balance.balance);
              return (
                <tr key={invoice.id} className="border-b border-border">
                  <td className="px-4 py-3"><Link className="text-blue" href={`/fees/invoices/${invoice.id}`}>{invoice.number}</Link></td>
                  <td className="px-4 py-3">{invoice.student ? `${invoice.student.firstName} ${invoice.student.lastName}` : "—"}</td>
                  <td className="px-4 py-3">{invoice.student?.enrollments[0]?.classRoom.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge tone={status === "paid" ? "success" : status === "overdue" || status === "cancelled" ? "danger" : "info"}>{status.replaceAll("_", " ")}</StatusBadge></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(balance.balance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Surface>
    </div>
  );
}
