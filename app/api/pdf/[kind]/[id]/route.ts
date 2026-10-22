import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { isoDate } from "@/lib/calendar";

function money(pesewas: number) {
  const sign = pesewas < 0 ? "-" : "";
  return `${sign}GHS ${(Math.abs(pesewas) / 100).toFixed(2)}`;
}

async function pdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  try {
    const logo = await readFile(path.join(process.cwd(), "public/images/golden-child-school-logo.jpg"));
    const image = await doc.embedJpg(logo);
    page.drawImage(image, { x: 48, y: 760, width: 48, height: 48 });
  } catch {
    // The crest is optional for the PDF if the file cannot be read.
  }
  page.drawText("Golden Child School", { x: 108, y: 788, size: 16, font: bold, color: rgb(0.06, 0.18, 0.39) });
  page.drawText(title, { x: 48, y: 730, size: 14, font: bold });
  lines.forEach((line, index) => {
    page.drawText(line.slice(0, 90), { x: 48, y: 700 - index * 18, size: 11, font });
  });
  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${title.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
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
    const student = await prisma.student.findUnique({ where: { id }, include: { invoices: { include: { items: true } }, payments: true, adjustments: true } });
    if (!student) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const charged = student.invoices.flatMap((invoice) => invoice.items).reduce((sum, item) => sum + item.amount, 0);
    const paid = student.payments.filter((payment) => !payment.reversedAt).reduce((sum, payment) => sum + payment.amount, 0);
    const adjusted = student.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    return pdf("Fee statement", [
      student.admissionNumber,
      `${student.firstName} ${student.lastName}`,
      `Charges ${money(charged)}`,
      `Adjustments ${money(adjusted)}`,
      `Payments ${money(paid)}`,
      `Balance ${money(charged + adjusted - paid)}`,
    ]);
  }

  if (kind === "report") {
    if (!can(user.role, "academics.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const snapshot = await prisma.reportCardSnapshot.findFirst({ where: { studentId: id }, orderBy: { version: "desc" }, include: { student: true } });
    if (!snapshot) return NextResponse.json({ error: "No published report card yet." }, { status: 404 });
    const payload = snapshot.payload as { name?: string; className?: string; subjects?: { subject: string; total: number | null; grade: string | null }[] };
    const lines = [`${payload.name ?? snapshot.student.firstName} · ${snapshot.yearLabel} ${snapshot.termLabel}`, payload.className ?? "", `Version ${snapshot.version}`];
    for (const subject of payload.subjects ?? []) lines.push(`${subject.subject}: ${subject.total ?? "—"} ${subject.grade ?? ""}`);
    return pdf("Report card", lines);
  }

  return NextResponse.json({ error: "Unknown document." }, { status: 404 });
}
