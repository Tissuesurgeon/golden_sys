import { notFound } from "next/navigation";
import { SchoolLogo } from "@/components/brand/school-logo";
import { LinkButton, PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { displayInvoiceStatus, invoiceBalance } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { isoDate } from "@/lib/calendar";
import { cancelInvoice } from "@/lib/server/billing";
import { requireFinance } from "@/lib/server/guard";

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireFinance();
  const { id } = await params;
  const { error } = await searchParams;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      student: true,
      items: true,
      adjustments: true,
      allocations: { include: { payment: true } },
      term: true,
      year: true,
    },
  });
  if (!invoice) notFound();
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const balance = invoiceBalance(invoice);
  const status = displayInvoiceStatus(invoice, balance.balance);
  const paid = invoice.allocations.filter((item) => !item.payment.reversedAt);

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`${invoice.termLabel}${invoice.year ? ` · ${invoice.year.label}` : ""} · ${status.replaceAll("_", " ")}`}
        actions={<LinkButton href={`/api/pdf/invoice/${invoice.id}`} variant="outline">Print PDF</LinkButton>}
      />
      {error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
      <Surface className="p-6">
        <div className="flex items-start justify-between gap-4">
          <SchoolLogo size={72} />
          <div className="text-right text-sm">
            <p className="font-semibold text-navy">{settings?.name}</p>
            <p className="text-muted-foreground">{settings?.town}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <p>{invoice.student ? `${invoice.student.firstName} ${invoice.student.lastName}` : "Admission invoice"}</p>
          <p className="sm:text-right">Issued {formatDate(isoDate(invoice.issuedOn))}</p>
          <p>{invoice.student?.admissionNumber}</p>
          <p className="sm:text-right">{invoice.dueOn ? `Due ${formatDate(isoDate(invoice.dueOn))}` : "No due date"}</p>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr><th className="py-2 font-medium">Line</th><th className="py-2 text-right font-medium">Amount</th></tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-border"><td className="py-2">{item.label}</td><td className="py-2 text-right tabular-nums">{formatMoney(item.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-sm">
          {paid.map((item) => (
            <p key={item.id} className="flex justify-between"><span>Payment {item.payment.receiptNumber}</span><span>{formatMoney(item.amount)}</span></p>
          ))}
          <p className="flex justify-between font-semibold text-navy"><span>Balance</span><span>{formatMoney(balance.balance)}</span></p>
        </div>
      </Surface>
      {can(user.role, "settings.manage") && invoice.status !== "cancelled" && invoice.status !== "carried_forward" ? (
        <Surface className="mt-4 p-5">
          <form action={cancelInvoice} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="min-w-[240px] flex-1 text-sm">
              Cancel this invoice
              <Input className="mt-1" name="reason" required minLength={3} placeholder="Reason" aria-label="Cancellation reason" />
            </label>
            <Button type="submit" variant="outline">Cancel invoice</Button>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}