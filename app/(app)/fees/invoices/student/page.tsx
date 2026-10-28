import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { confirmStudentInvoice, previewStudentInvoice } from "@/lib/server/billing";
import { requireInvoiceGeneration } from "@/lib/server/guard";

export default async function StudentInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; yearId?: string; termId?: string; error?: string }>;
}) {
  await requireInvoiceGeneration();
  const query = await searchParams;
  const [years, students] = await Promise.all([
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.student.findMany({ where: { status: "active" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 300 }),
  ]);
  const yearId = query.yearId || years[0]?.id || "";
  const year = years.find((item) => item.id === yearId) ?? years[0];
  const termId = query.termId || year?.terms[0]?.id || "";
  const studentId = query.studentId || "";
  const preview = studentId && yearId && termId ? await previewStudentInvoice(studentId, yearId, termId) : null;
  const ready = preview && !("error" in preview) && !preview.alreadyInvoiced && preview.lines.length > 0;

  return (
    <div>
      <PageHeader title="Generate invoice" description="One student, one term. New and returning fees follow the enrolment date. Add a one-off line, such as a lost book, only with a reason." />
      {query.error ? <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{query.error}</p> : null}
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 sm:grid-cols-4">
          <select className={selectClassName()} name="studentId" defaultValue={studentId} aria-label="Student">
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.lastName}, {student.firstName} · {student.admissionNumber}</option>
            ))}
          </select>
          <select className={selectClassName()} name="yearId" defaultValue={yearId} aria-label="Academic year">
            {years.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className={selectClassName()} name="termId" defaultValue={termId} aria-label="Term">
            {(year?.terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
          <Button type="submit" variant="outline">Preview</Button>
        </form>
      </Surface>
      {preview && "error" in preview ? <p className="mb-4 text-sm text-danger">{preview.error}</p> : null}
      {preview && !("error" in preview) ? (
        <Surface className="p-5">
          <p className="text-sm text-ink">
            {preview.name} · {preview.className} · {preview.audience === "new" ? "New" : "Returning"}
          </p>
          {preview.alreadyInvoiced ? (
            <p className="mt-2 text-sm text-muted-foreground">Already invoiced as {preview.existingNumber}. A second invoice is not created.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {preview.lines.map((line) => (
                <li key={`${line.label}-${line.amount}`} className="flex justify-between gap-3">
                  <span>{line.label}</span>
                  <span className="tabular-nums">{formatMoney(line.amount)}</span>
                </li>
              ))}
              {preview.lines.length === 0 ? <li className="text-muted-foreground">No fee lines for this student.</li> : null}
            </ul>
          )}
          <p className="mt-3 text-sm font-medium text-navy">Total {formatMoney(preview.total)}</p>
          <form action={confirmStudentInvoice} className="mt-4 grid gap-3">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="yearId" value={yearId} />
            <input type="hidden" name="termId" value={termId} />
            <p className="text-sm text-muted-foreground">Optional one-off lines. Leave a row blank, or fill the description, amount, and reason.</p>
            {[1, 2].map((index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <Input name={`extraLabel${index}`} placeholder="Description, e.g. lost book" aria-label={`Extra line ${index} description`} />
                <Input name={`extraAmount${index}`} type="number" min={0} step="0.01" placeholder="Amount (GHS)" aria-label={`Extra line ${index} amount`} />
                <Input name={`extraReason${index}`} placeholder="Reason" aria-label={`Extra line ${index} reason`} />
              </div>
            ))}
            <Button type="submit" disabled={!ready}>Confirm invoice</Button>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
