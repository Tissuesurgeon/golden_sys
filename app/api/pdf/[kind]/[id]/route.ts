import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isoDate } from "@/lib/calendar";
import { invoiceBalance } from "@/lib/finance";
import { pdfResponse, renderPdf } from "@/lib/pdf";

async function teacherOwnsStudent(user: CurrentUser, studentId: string) {
  if (user.role === "administrator") return true;
  if (!user.staffId) return false;
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { studentId, active: true, yearId: settings?.academicYearId ?? undefined },
    include: { classRoom: true },
  });
  if (!enrollment) return false;
  if (enrollment.classRoom.teacherId === user.staffId) return true;
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { staffId: user.staffId, classId: enrollment.classId, yearId: enrollment.yearId },
  });
  return Boolean(assignment);
}

function money(pesewas: number) {
  const sign = pesewas < 0 ? "-" : "";
  return `${sign}GHS ${(Math.abs(pesewas) / 100).toFixed(2)}`;
}

async function pdf(title: string, lines: string[]) {
  return pdfResponse(title, await renderPdf(title, lines));
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { kind, id } = await params;

  if (kind === "receipt") {
    if (!can(user.role, "finance.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const payment = await prisma.payment.findUnique({ where: { id }, include: { student: true, allocations: true } });
    if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return pdf("Receipt", [
      payment.receiptNumber,
      `Date ${isoDate(payment.paidOn)}`,
      `Amount ${money(payment.amount)}`,
      `Method ${payment.method.replaceAll("_", " ")}`,
      payment.reference ? `Reference ${payment.reference}` : "No reference",
      "Recorded by the school. Not verified by a payment gateway.",
      payment.reversedAt ? "This receipt has been reversed." : "This receipt is a school record.",
    ]);
  }

  if (kind === "invoice") {
    if (!can(user.role, "finance.read") && !can(user.role, "admissions.manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, student: true, application: true } });
    if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const lines = [invoice.number, `Issued ${isoDate(invoice.issuedOn)}`, invoice.student ? `${invoice.student.firstName} ${invoice.student.lastName}` : invoice.application ? `${invoice.application.firstName} ${invoice.application.lastName}` : ""];
    for (const item of invoice.items) lines.push(`${item.label}  ${money(item.amount)}`);
    return pdf("Invoice", lines.filter(Boolean));
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
    return pdf("Fee statement", [
      student.admissionNumber,
      `${student.firstName} ${student.lastName}`,
      `Charges ${money(totals.charges)}`,
      `Adjustments ${money(totals.adjustments)}`,
      `Payments ${money(totals.paid)}`,
      `Balance ${money(totals.balance)}`,
    ]);
  }

  if (kind === "report") {
    if (!can(user.role, "academics.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const snapshot = await prisma.reportCardSnapshot.findFirst({ where: { studentId: id }, orderBy: { version: "desc" }, include: { student: true } });
    if (!snapshot) return NextResponse.json({ error: "No published report card yet." }, { status: 404 });
    if (!(await teacherOwnsStudent(user, snapshot.studentId))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const payload = snapshot.payload as { name?: string; className?: string; subjects?: { subject: string; total: number | null; grade: string | null }[] };
    const lines = [`${payload.name ?? snapshot.student.firstName} · ${snapshot.yearLabel} ${snapshot.termLabel}`, payload.className ?? "", `Version ${snapshot.version}`];
    for (const subject of payload.subjects ?? []) lines.push(`${subject.subject}: ${subject.total ?? "—"} ${subject.grade ?? ""}`);
    return pdf("Report card", lines);
  }

  return NextResponse.json({ error: "Unknown document." }, { status: 404 });
}
