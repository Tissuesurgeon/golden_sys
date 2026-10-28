import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { confirmTermInvoices, previewTermInvoices } from "@/lib/server/billing";
import { requireFinance } from "@/lib/server/guard";

export default async function GenerateInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ yearId?: string; termId?: string; classId?: string; error?: string }>;
}) {
  await requireFinance();
  const query = await searchParams;
  const [years, classes] = await Promise.all([
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
  ]);
  const yearId = query.yearId || years[0]?.id || "";
  const year = years.find((item) => item.id === yearId) ?? years[0];
  const termId = query.termId || year?.terms[0]?.id || "";
  const classId = query.classId || "all";
  const preview = yearId && termId ? await previewTermInvoices(yearId, termId, classId) : [];
  const grand = preview.reduce((sum, row) => sum + row.total, 0);

  return (
    <div>
      <PageHeader title="Generate term invoices" description="One invoice per student for the term. A second run skips anyone who already has one." />
      {query.error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{query.error}</p> : null}
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 sm:grid-cols-4">
          <select className={selectClassName()} name="yearId" defaultValue={yearId} aria-label="Academic year">
            {years.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className={selectClassName()} name="termId" defaultValue={termId} aria-label="Term">
            {(year?.terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
          <select className={selectClassName()} name="classId" defaultValue={classId} aria-label="Class">
            <option value="all">All classes</option>
            {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <Button type="submit" variant="outline">Preview</Button>
        </form>
      </Surface>
      <Surface className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Lines</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row) => (
              <tr key={row.studentId} className="border-b border-border">
                <td className="px-4 py-3">{row.name}<div className="text-xs text-muted-foreground">{row.admissionNumber}</div></td>
                <td className="px-4 py-3">{row.className}</td>
                <td className="px-4 py-3">{row.lines.map((line) => line.label).join(", ") || "No lines"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm font-medium text-navy">Grand total {formatMoney(grand)} · {preview.length} students</p>
          <form action={confirmTermInvoices}>
            <input type="hidden" name="yearId" value={yearId} />
            <input type="hidden" name="termId" value={termId} />
            <input type="hidden" name="classId" value={classId} />
            <Button type="submit" disabled={preview.length === 0}>Confirm invoices</Button>
          </form>
        </div>
      </Surface>
    </div>
  );
}
