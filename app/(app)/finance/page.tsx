import Link from "next/link";
import { CollectionsChart } from "@/components/finance/collections-chart";
import { LinkButton, PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { financeReport, type FinanceFilters } from "@/lib/server/finance-report";
import { requireFinance } from "@/lib/server/guard";

export default async function FinancePage({ searchParams }: { searchParams: Promise<FinanceFilters> }) {
  await requireFinance();
  const filters = await searchParams;
  const [years, classes, report] = await Promise.all([
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
    financeReport(filters),
  ]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Fees income only. Cancelled, reversed, and carried-forward invoices stay out of the outstanding total."
        actions={
          <>
            <LinkButton href={`/api/finance/csv?${query}`} variant="outline">Export CSV</LinkButton>
            <LinkButton href={`/api/finance/pdf?${query}`} variant="outline">Report PDF</LinkButton>
          </>
        }
      />
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 md:grid-cols-3">
          <Input name="from" type="date" defaultValue={filters.from || ""} aria-label="From" />
          <Input name="to" type="date" defaultValue={filters.to || ""} aria-label="To" />
          <select className={selectClassName()} name="yearId" defaultValue={filters.yearId || ""} aria-label="Academic year">
            <option value="">All years</option>
            {years.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
          </select>
          <select className={selectClassName()} name="termId" defaultValue={filters.termId || ""} aria-label="Term">
            <option value="">All terms</option>
            {years.flatMap((year) => year.terms.map((term) => <option key={term.id} value={term.id}>{year.label} {term.label}</option>))}
          </select>
          <select className={selectClassName()} name="classId" defaultValue={filters.classId || ""} aria-label="Class">
            <option value="">All classes</option>
            {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <Button type="submit" variant="outline">Apply filters</Button>
        </form>
      </Surface>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card label="Billed" value={formatMoney(report.billed)} />
        <Card label="Collected" value={formatMoney(report.collected)} />
        <Card label="Outstanding" value={formatMoney(report.outstanding)} />
        <Card label="Collection rate" value={`${report.rate}%`} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <MoneyTable title="By method" rows={report.byMethod.map((row) => [row.method.replaceAll("_", " "), formatMoney(row.amount)])} />
        <MoneyTable title="By fee item" rows={report.byItem.map((row) => [row.item, formatMoney(row.amount)])} />
        <MoneyTable title="By class" rows={report.byClass.map((row) => [row.className, formatMoney(row.amount)])} />
      </div>
      <Surface className="mb-4 p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy">Collections over time</h2>
        <CollectionsChart points={report.series} />
      </Surface>
      <Surface className="mb-4 p-5">
        <h2 className="mb-3 text-lg font-semibold text-navy">Arrears ageing</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(report.ageing).map(([label, amount]) => <Card key={label} label={label} value={formatMoney(amount)} />)}
        </div>
      </Surface>
      <Surface className="mb-4 overflow-x-auto">
        <h2 className="px-4 pt-4 text-lg font-semibold text-navy">Debtors</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Class</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Oldest due</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
          <tbody>
            {report.debtors.map((row) => (
              <tr key={row.studentId} className="border-t border-border">
                <td className="px-4 py-2"><Link className="text-blue" href={`/fees/statements/${row.studentId}`}>{row.name}</Link></td>
                <td className="px-4 py-2">{row.className}</td>
                <td className="px-4 py-2">{row.phone || "—"}</td>
                <td className="px-4 py-2">{row.dueOn || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
      <Surface className="p-5">
        <h2 className="text-lg font-semibold text-navy">Daily cash summary</h2>
        <form className="mt-3 flex flex-wrap items-end gap-3">
          {filters.from ? <input type="hidden" name="from" value={filters.from} /> : null}
          {filters.to ? <input type="hidden" name="to" value={filters.to} /> : null}
          {filters.yearId ? <input type="hidden" name="yearId" value={filters.yearId} /> : null}
          {filters.termId ? <input type="hidden" name="termId" value={filters.termId} /> : null}
          {filters.classId ? <input type="hidden" name="classId" value={filters.classId} /> : null}
          <Input name="cashDate" type="date" defaultValue={report.cashDate} aria-label="Cash date" />
          <Button type="submit" variant="outline">Show day</Button>
        </form>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">Receipt</th><th>Method</th><th>Recorded by</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {report.cash.map((row) => (
              <tr key={row.receipt} className="border-t border-border"><td className="py-2">{row.receipt}</td><td>{row.method.replaceAll("_", " ")}</td><td>{row.recorder}</td><td className="text-right tabular-nums">{formatMoney(row.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm font-semibold text-navy">Total {formatMoney(report.cashTotal)}. Print this page for the daily summary.</p>
      </Surface>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <Surface className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold text-navy">{value}</p></Surface>;
}

function MoneyTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <Surface className="p-4">
      <h2 className="mb-2 font-semibold text-navy">{title}</h2>
      <ul className="space-y-1 text-sm">
        {rows.length === 0 ? <li className="text-muted-foreground">Nothing in this filter.</li> : rows.map((row) => <li key={row[0]} className="flex justify-between gap-3"><span>{row[0]}</span><span className="tabular-nums">{row[1]}</span></li>)}
      </ul>
    </Surface>
  );
}
