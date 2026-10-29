import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isoDate } from "@/lib/calendar";
import { paymentInstructions } from "@/lib/bills";
import { invoiceBalance } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { pdfResponse, renderPdf, renderSchoolPdf, type PdfTable, type SchoolHeading } from "@/lib/pdf";
import { composeClassBills, composeStudentBill } from "@/lib/server/fee-bill";

async function teacherOwnsStudent(user: CurrentUser, studentId: string) {
  if (user.role === "administrator") return true;
  if (!user.staffId) return false;
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { studentId, active: true, yearId: settings?.academicYearId ?? undefined },
    include: { classRoom: true },
  });
  if (!enrollment) return false;
  return enrollment.classRoom.teacherId === user.staffId;
}

function money(pesewas: number) {
  const sign = pesewas < 0 ? "-" : "";
  return `${sign}GHS ${(Math.abs(pesewas) / 100).toFixed(2)}`;
}

async function pdf(title: string, lines: string[]) {
  return pdfResponse(title, await renderPdf(title, lines));
}

async function schoolHeading(): Promise<SchoolHeading> {
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  return {
    name: settings?.name ?? "Golden Child School",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
  };
}

async function schoolPdf(title: string, tables: PdfTable[]) {
  return pdfResponse(title, await renderSchoolPdf(await schoolHeading(), tables));
}

function billTable(bill: Exclude<Awaited<ReturnType<typeof composeStudentBill>>, { error: string }>): PdfTable {
  const printed = formatDate(isoDate(new Date()));
  return {
    title: "FEE BILL",
    lines: [
      `${bill.term.year.label} ${bill.term.label}`,
      `${bill.student.firstName} ${bill.student.lastName}`,
      `Admission number ${bill.student.admissionNumber}`,
      `Class ${bill.className}`,
    ],
    rows: [
      ...bill.bill.lines.map((line) => ({ label: line.label, value: money(line.amount) })),
      { label: "Balance brought forward", value: money(bill.bill.balanceBroughtForward) },
      { label: "Total", value: money(bill.bill.total) },
      { label: "Payments received", value: money(bill.bill.paid) },
      ...(bill.bill.adjustments ? [{ label: "Adjustments", value: money(bill.bill.adjustments) }] : []),
      { label: "Amount due", value: money(bill.bill.due), bold: true },
      { label: "Due date", value: formatDate(isoDate(bill.dueOn)) },
    ],
    after: [paymentInstructions(bill.settings), `Printed ${printed}`],
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { kind, id } = await params;

  if (kind === "receipt") {
    if (!can(user.role, "finance.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const payment = await prisma.payment.findUnique({ where: { id }, include: { student: true, allocations: true } });
    if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const who = payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : "School receipt";
    return schoolPdf("Receipt", [{
      title: "RECEIPT",
      lines: [payment.receiptNumber, who, `Date ${formatDate(isoDate(payment.paidOn))}`, `Method ${payment.method.replaceAll("_", " ")}`, payment.reference ? `Reference ${payment.reference}` : "No reference"],
      rows: [{ label: "Amount", value: money(payment.amount), bold: true }],
      after: [payment.reversedAt ? "This receipt has been reversed." : "This receipt is a school record."],
    }]);
  }

  if (kind === "invoice") {
    if (!can(user.role, "finance.read") && !can(user.role, "admissions.manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, student: true, application: true } });
    if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const who = invoice.student
      ? `${invoice.student.firstName} ${invoice.student.lastName}`
      : invoice.application
        ? `${invoice.application.firstName} ${invoice.application.lastName}`
        : "";
    const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    return schoolPdf("Invoice", [{
      title: "INVOICE",
      lines: [invoice.number, who, `Issued ${formatDate(isoDate(invoice.issuedOn))}`, invoice.termLabel].filter(Boolean),
      rows: [
        ...invoice.items.map((item) => ({ label: item.label, value: money(item.amount) })),
        { label: "Total", value: money(total), bold: true },
      ],
    }]);
  }

  if (kind === "bill") {
    if (!can(user.role, "invoices.generate")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const url = new URL(request.url);
    const termId = url.searchParams.get("termId") || "";
    if (!termId) return NextResponse.json({ error: "Choose a term." }, { status: 400 });
    if (url.searchParams.get("scope") === "class") {
      const bills = await composeClassBills(id, termId);
      if ("error" in bills) return NextResponse.json({ error: bills.error }, { status: 404 });
      return schoolPdf("Fee bills", bills.bills.map(billTable));
    }
    const bill = await composeStudentBill(id, termId);
    if ("error" in bill) return NextResponse.json({ error: bill.error }, { status: 404 });
    return schoolPdf("Fee bill", [billTable(bill)]);
  }

  if (kind === "statement") {
    if (!can(user.role, "finance.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const student = await prisma.student.findUnique({
      where: { id },
      include: { invoices: { include: { items: true, adjustments: true, allocations: { include: { payment: true } } } } },
    });
    if (!student) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const totals = student.invoices.reduce(
      (sum, invoice) => {
        const balance = invoiceBalance(invoice);
        return { charges: sum.charges + balance.charges, adjustments: sum.adjustments + balance.adjustments, paid: sum.paid + balance.paid, balance: sum.balance + balance.balance };
      },
      { charges: 0, adjustments: 0, paid: 0, balance: 0 },
    );
    return schoolPdf("Fee statement", [{
      title: "FEE STATEMENT",
      lines: [`${student.firstName} ${student.lastName}`, `Admission number ${student.admissionNumber}`],
      rows: [
        { label: "Charges", value: money(totals.charges) },
        { label: "Adjustments", value: money(totals.adjustments) },
        { label: "Payments", value: money(totals.paid) },
        { label: "Balance", value: money(totals.balance), bold: true },
      ],
    }]);
  }

  if (kind === "report") {
    if (!can(user.role, "academics.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!(await teacherOwnsStudent(user, id))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const snapshot = await prisma.reportCardSnapshot.findFirst({ where: { studentId: id }, orderBy: { version: "desc" }, include: { student: true } });
    if (!snapshot) return NextResponse.json({ error: "No published report card yet." }, { status: 404 });
    const payload = snapshot.payload as {
      name?: string;
      className?: string;
      level?: string;
      position?: number | null;
      subjects?: { subject: string; total: number | null; grade: string | null; remark?: string | null }[];
      attendance?: { present: number; absent: number; late: number; daysOpen: number };
      termReport?: { remark: string; conduct: string; attitude: string; interest: string } | null;
    };
    const lines = [`${payload.name ?? snapshot.student.firstName} · ${snapshot.yearLabel} ${snapshot.termLabel}`, payload.className ?? "", `Version ${snapshot.version}`];
    if (payload.position != null) lines.push(`Position ${payload.position}`);
    for (const subject of payload.subjects ?? []) lines.push(`${subject.subject}: ${subject.total ?? "—"} ${subject.grade ?? ""}`);
    if (payload.attendance) {
      lines.push(
        `Attendance present ${payload.attendance.present}, absent ${payload.attendance.absent}, late ${payload.attendance.late}, days open ${payload.attendance.daysOpen}`,
      );
    }
    if (payload.termReport?.remark) lines.push(`Class teacher: ${payload.termReport.remark}`);
    if (payload.termReport?.conduct) lines.push(`Conduct ${payload.termReport.conduct}`);
    if (payload.termReport?.attitude) lines.push(`Attitude ${payload.termReport.attitude}`);
    if (payload.termReport?.interest) lines.push(`Interest ${payload.termReport.interest}`);
    return pdf("Report card", lines);
  }

  return NextResponse.json({ error: "Unknown document." }, { status: 404 });
}
