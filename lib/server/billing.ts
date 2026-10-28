"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/audit";
import { isoDate } from "@/lib/calendar";
import { invoiceBalance } from "@/lib/finance";
import { addDays, splitInvoiceRun, termInvoiceLines } from "@/lib/invoices";
import { assertCan } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";

const openStatuses = ["issued", "partial", "overdue"] as const;

async function officeUser(write: boolean) {
  const user = await requireUser();
  assertCan(user.role, write ? "finance.write" : "finance.read");
  return user;
}

export async function saveDueDays(formData: FormData) {
  const user = await officeUser(true);
  assertCan(user.role, "settings.manage");
  const days = Number(formData.get("invoiceDueDays") || 14);
  if (!Number.isInteger(days) || days < 0 || days > 120) redirect("/fees/items?error=Due%20days%20must%20be%20between%200%20and%20120");
  await prisma.schoolSettings.update({ where: { id: "school" }, data: { invoiceDueDays: days } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "settings.updated", entityType: "SchoolSettings", entityId: "school", summary: `Invoice due days set to ${days}` },
  });
  revalidatePath("/fees/items");
  redirect("/fees/items");
}

export async function saveFeeItem(formData: FormData) {
  const user = await officeUser(true);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Math.round(Number(formData.get("amount") || 0) * 100);
  const active = formData.get("active") === "on";
  const termId = String(formData.get("termId") || "");
  if (name.length < 2 || !Number.isInteger(amount) || amount < 0) redirect("/fees/items?error=Enter%20a%20name%20and%20amount");
  const fee = id
    ? await prisma.feeItem.update({ where: { id }, data: { name, amount, active } })
    : await prisma.feeItem.create({ data: { name, amount, active, kind: "school_fee" } });
  if (termId) {
    const classes = await prisma.classRoom.findMany({ select: { id: true } });
    for (const room of classes) {
      const raw = formData.get(`class-${room.id}`);
      if (raw == null || String(raw).trim() === "") {
        await prisma.feeSchedule.deleteMany({ where: { feeItemId: fee.id, classId: room.id, termId } });
        continue;
      }
      const scheduled = Math.round(Number(raw) * 100);
      if (!Number.isInteger(scheduled) || scheduled < 0) continue;
      await prisma.feeSchedule.upsert({
        where: { feeItemId_classId_termId: { feeItemId: fee.id, classId: room.id, termId } },
        create: { feeItemId: fee.id, classId: room.id, termId, amount: scheduled },
        update: { amount: scheduled },
      });
    }
  }
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "fee_item.saved", entityType: "FeeItem", entityId: fee.id, summary: `Saved ${fee.name}` },
  });
  revalidatePath("/fees/items");
  redirect("/fees/items");
}

export async function previewTermInvoices(yearId: string, termId: string, classId: string) {
  await officeUser(false);
  const term = await prisma.term.findUnique({ where: { id: termId }, include: { year: true } });
  if (!term || term.yearId !== yearId) return [];
  const classes = await prisma.classRoom.findMany({ where: classId && classId !== "all" ? { id: classId } : undefined, orderBy: { name: "asc" } });
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const rows = [];
  for (const room of classes) {
    const students = await prisma.student.findMany({
      where: { status: "active", enrollments: { some: { classId: room.id, yearId, active: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const fees = await feesForClass(room.id, termId);
    for (const student of students) {
      const arrears = await arrearsFor(student.id, term.startsOn);
      const lines = termInvoiceLines(fees, arrears);
      rows.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        className: room.name,
        lines,
        total: lines.reduce((sum, line) => sum + line.amount, 0),
        dueOn: isoDate(addDays(term.startsOn, settings?.invoiceDueDays ?? 14)),
      });
    }
  }
  return rows;
}

async function feesForClass(classId: string, termId: string) {
  const items = await prisma.feeItem.findMany({
    where: { active: true, kind: "school_fee" },
    include: { schedules: { where: { classId, termId } }, classes: true },
  });
  return items
    .filter((item) => item.classes.length === 0 || item.classes.some((link) => link.classId === classId))
    .map((item) => ({ id: item.id, name: item.name, amount: item.schedules[0]?.amount ?? item.amount }));
}

async function arrearsFor(studentId: string, before: Date) {
  const invoices = await prisma.invoice.findMany({
    where: {
      studentId,
      kind: "school_fee",
      status: { in: [...openStatuses] },
      issuedOn: { lt: before },
    },
    include: { items: true, adjustments: true, allocations: { include: { payment: true } } },
  });
  return invoices.reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(invoice).balance), 0);
}

export async function confirmTermInvoices(formData: FormData) {
  const user = await officeUser(true);
  const yearId = String(formData.get("yearId") || "");
  const termId = String(formData.get("termId") || "");
  const classId = String(formData.get("classId") || "all");
  const term = await prisma.term.findUnique({ where: { id: termId }, include: { year: true } });
  if (!term || term.yearId !== yearId) redirect("/fees/invoices/generate?error=Choose%20a%20term");
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const dueOn = addDays(term.startsOn, settings?.invoiceDueDays ?? 14);
  const classes = await prisma.classRoom.findMany({ where: classId !== "all" ? { id: classId } : undefined });
  let created = 0;
  const skipped: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const room of classes) {
      const students = await tx.student.findMany({
        where: { status: "active", enrollments: { some: { classId: room.id, yearId, active: true } } },
      });
      const existing = await tx.invoice.findMany({
        where: { studentId: { in: students.map((student) => student.id) }, termId, kind: "school_fee" },
        select: { studentId: true },
      });
      const run = splitInvoiceRun(
        students.map((student) => student.id),
        new Set(existing.map((invoice) => invoice.studentId).filter((id): id is string => Boolean(id))),
      );
      skipped.push(...run.skipped);
      const fees = await feesForClass(room.id, termId);
      for (const studentId of run.create) {
        const prior = await tx.invoice.findMany({
          where: { studentId, kind: "school_fee", status: { in: [...openStatuses] }, issuedOn: { lt: term.startsOn } },
          include: { items: true, adjustments: true, allocations: { include: { payment: true } } },
        });
        const arrears = prior.reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(invoice).balance), 0);
        const lines = termInvoiceLines(fees, arrears);
        if (lines.length === 0) continue;
        const number = await nextDocumentNumber(tx, "invoice", new Date());
        const invoice = await tx.invoice.create({
          data: {
            number,
            kind: "school_fee",
            status: "issued",
            studentId,
            yearId,
            termId,
            termLabel: term.label,
            issuedOn: new Date(),
            dueOn,
            items: { create: lines.map((line) => ({ label: line.label, amount: line.amount, feeItemId: line.feeItemId })) },
          },
        });
        if (arrears > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: prior.map((item) => item.id) } },
            data: { status: "carried_forward", carriedToInvoiceId: invoice.id },
          });
        }
        created += 1;
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "invoices.generated",
        entityType: "Invoice",
        entityId: termId,
        summary: `Generated ${created} ${term.label} invoices. Skipped ${skipped.length}.`,
      },
    });
  });
  revalidatePath("/fees/invoices");
  redirect(`/fees/invoices?created=${created}&skipped=${skipped.length}`);
}

export async function cancelInvoice(formData: FormData) {
  const user = await requireUser();
  assertCan(user.role, "settings.manage");
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 3) redirect(`/fees/invoices/${id}?error=A%20reason%20is%20required`);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { allocations: { include: { payment: true } } },
  });
  if (!invoice) redirect("/fees/invoices");
  const allocated = invoice.allocations.some((item) => !item.payment.reversedAt && item.amount > 0);
  if (allocated) redirect(`/fees/invoices/${id}?error=Payments%20are%20allocated%20to%20this%20invoice`);
  await prisma.invoice.update({ where: { id }, data: { status: "cancelled", notes: reason } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "invoice.cancelled", entityType: "Invoice", entityId: id, summary: reason },
  });
  revalidatePath(`/fees/invoices/${id}`);
  redirect(`/fees/invoices/${id}`);
}
