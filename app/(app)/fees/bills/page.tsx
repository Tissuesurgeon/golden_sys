import Link from "next/link";
import { LinkButton, PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { PrintButton } from "@/components/print/print-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentInstructions } from "@/lib/bills";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { composeStudentBill } from "@/lib/server/fee-bill";
import { requireInvoiceGeneration } from "@/lib/server/guard";

export default async function FeeBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ yearId?: string; termId?: string; classId?: string; studentId?: string; q?: string }>;
}) {
  await requireInvoiceGeneration();
  const query = await searchParams;
  const [settings, years, classes] = await Promise.all([
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
    prisma.academicYear.findMany({ include: { terms: { orderBy: { position: "asc" } } }, orderBy: { label: "desc" } }),
    prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
  ]);
  const yearId = query.yearId || settings?.academicYearId || years[0]?.id || "";
  const year = years.find((item) => item.id === yearId) ?? years[0];
  const termId = query.termId || (year?.id === settings?.academicYearId ? settings?.currentTermId ?? "" : "") || year?.terms[0]?.id || "";
  const term = year?.terms.find((item) => item.id === termId) ?? year?.terms[0];
  const classId = query.classId || "";
  const studentId = query.studentId || "";
  const q = (query.q || "").trim();
  const students = q || classId
    ? await prisma.student.findMany({
        where: {
          status: "active",
          enrollments: { some: { yearId, active: true, ...(classId ? { classId } : {}) } },
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { admissionNumber: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 80,
      })
    : [];
  const selected = studentId && term ? await composeStudentBill(studentId, term.id) : null;
  const keep = `yearId=${encodeURIComponent(yearId)}&termId=${encodeURIComponent(term?.id ?? "")}&classId=${encodeURIComponent(classId)}&q=${encodeURIComponent(q)}`;

  return (
    <div>
      <PageHeader
        title="Fee bills"
        description="A fee bill prints the current fees for the term. Print it again after a fee change and the new amount is on the page."
      />
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 sm:grid-cols-5">
          <select className={selectClassName()} name="yearId" defaultValue={yearId} aria-label="Academic year">
            {years.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className={selectClassName()} name="termId" defaultValue={term?.id || ""} aria-label="Term">
            {(year?.terms ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className={selectClassName()} name="classId" defaultValue={classId} aria-label="Class">
            <option value="">All classes</option>
            {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <Input name="q" defaultValue={q} placeholder="Name or admission number" aria-label="Search students" />
          <Button type="submit" variant="outline">Find</Button>
        </form>
      </Surface>
      {classId && term ? (
        <div className="mb-4">
          <LinkButton href={`/api/pdf/bill/${classId}?termId=${encodeURIComponent(term.id)}&scope=class`} variant="outline">
            Download class PDF
          </LinkButton>
        </div>
      ) : null}
      {students.length > 0 ? (
        <Surface className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Admission number</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-border">
                  <td className="px-4 py-3">{student.lastName}, {student.firstName}</td>
                  <td className="px-4 py-3">{student.admissionNumber}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-navy underline" href={`/fees/bills?${keep}&studentId=${student.id}`}>Open bill</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : null}
      {selected && "error" in selected ? <p className="text-sm text-danger">{selected.error}</p> : null}
      {selected && !("error" in selected) ? (
        <Surface className="p-5 print:border-0 print:shadow-none">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
            <p className="text-sm text-muted-foreground">{selected.audience === "new" ? "New student" : "Returning student"}{selected.invoiceNumber ? ` · Invoice ${selected.invoiceNumber}` : ""}</p>
            <div className="flex gap-2">
              <PrintButton label="Print" />
              <LinkButton href={`/api/pdf/bill/${selected.student.id}?termId=${encodeURIComponent(selected.term.id)}`} variant="outline">Download PDF</LinkButton>
            </div>
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.settings.name}</p>
          <h2 className="mt-1 text-xl font-semibold text-navy">Fee bill</h2>
          <p className="mt-2 text-sm">{selected.term.year.label} {selected.term.label}</p>
          <p className="text-sm">{selected.student.firstName} {selected.student.lastName}</p>
          <p className="text-sm">Admission number {selected.student.admissionNumber}</p>
          <p className="text-sm">Class {selected.className}</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {selected.bill.lines.map((line) => (
                <tr key={`${line.label}-${line.amount}`} className="border-b border-border">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(line.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-border">
                <td className="py-2">Balance brought forward</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(selected.bill.balanceBroughtForward)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(selected.bill.total)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2">Payments received</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(selected.bill.paid)}</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-navy">Amount due</td>
                <td className="py-2 text-right font-semibold tabular-nums text-navy">{formatMoney(selected.bill.due)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-sm">Due {formatDate(isoDate(selected.dueOn))}</p>
          <p className="mt-2 text-sm">{paymentInstructions(selected.settings)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Printed {formatDate(isoDate(new Date()))}</p>
        </Surface>
      ) : null}
    </div>
  );
}
