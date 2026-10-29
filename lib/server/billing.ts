import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/audit";
import { invoiceBalance } from "@/lib/finance";
import { currentFeeLines, planInvoiceUpdate } from "@/lib/bills";
import { addDays, parseExtraLines, studentAudience, type FeeAppliesTo, type TermSpan } from "@/lib/invoices";
import { feesForClass } from "@/lib/server/invoice-preview";
import { assertCan } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { requireInvoiceGeneration } from "@/lib/server/guard";
import type { Prisma } from "@prisma/client";

async function officeUser(write: boolean) {
  const user = await requireUser();
  assertCan(user.role, write ? "finance.write" : "finance.read");
  return user;
}

export async function saveDueDays(formData: FormData) {
  "use server";
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
  "use server";
  const user = await officeUser(true);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Math.round(Number(formData.get("amount") || 0) * 100);
  const active = formData.get("active") === "on";
  const appliesTo = String(formData.get("appliesTo") || "all");
  const termId = String(formData.get("termId") || "");
  if (name.length < 2 || !Number.isInteger(amount) || amount < 0) redirect("/fees/items?error=Enter%20a%20name%20and%20amount");
  if (appliesTo !== "new" && appliesTo !== "returning" && appliesTo !== "all") redirect("/fees/items?error=Choose%20who%20the%20fee%20applies%20to");
  const fee = id
    ? await prisma.feeItem.update({ where: { id }, data: { name, amount, active, appliesTo } })
    : await prisma.feeItem.create({ data: { name, amount, active, appliesTo, kind: "school_fee" } });
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

export async function confirmTermInvoices(formData: FormData) {
  "use server";
  const user = await requireInvoiceGeneration();
  const yearId = String(formData.get("yearId") || "");
  const termId = String(formData.get("termId") || "");
  const classId = String(formData.get("classId") || "all");
  const cohort = String(formData.get("cohort") || "both");
  const audience = cohort === "new" || cohort === "returning" ? cohort : "both";
  const term = await prisma.term.findUnique({ where: { id: termId }, include: { year: true } });
  if (!term || term.yearId !== yearId) redirect("/fees/invoices/generate?error=Choose%20a%20term");
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const dueOn = addDays(term.startsOn, settings?.invoiceDueDays ?? 14);
  const classes = await prisma.classRoom.findMany({ where: classId !== "all" ? { id: classId } : undefined });
  const terms = await prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } });
  const tally = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
  for (const room of classes) {
    const students = await prisma.student.findMany({
      where: { status: "active", enrollments: { some: { classId: room.id, yearId, active: true } } },
    });
    const fees = await feesForClass(prisma, room.id, termId);
    for (const student of students) {
      const group = studentAudience(student.enrolledOn, term, terms);
      if (group === "not_enrolled" || (audience !== "both" && group !== audience)) {
        tally.skipped += 1;
        continue;
      }
      const made = await prisma.$transaction((tx) =>
        createTermInvoice(tx, user.id, {
          student,
          classId: room.id,
          yearId,
          term,
          terms,
          dueOn,
          fees,
          audience: group,
        }),
      );
      tally[made.reason === "empty" ? "skipped" : made.reason] += 1;
    }
  }
  revalidatePath("/fees/invoices");
  redirect(`/fees/invoices?created=${tally.created}&updated=${tally.updated}&unchanged=${tally.unchanged}&skipped=${tally.skipped}`);
}

export async function confirmStudentInvoice(formData: FormData) {
  "use server";
  const user = await requireInvoiceGeneration();
  const studentId = String(formData.get("studentId") || "");
  const yearId = String(formData.get("yearId") || "");
  const termId = String(formData.get("termId") || "");
  const back = `/fees/invoices/student?studentId=${encodeURIComponent(studentId)}&yearId=${encodeURIComponent(yearId)}&termId=${encodeURIComponent(termId)}`;
  const extras = parseExtraLines([1, 2].map((index) => ({
    label: String(formData.get(`extraLabel${index}`) || ""),
    amountPesewas: Math.round(Number(formData.get(`extraAmount${index}`) || 0) * 100),
    reason: String(formData.get(`extraReason${index}`) || ""),
  })));
  if ("error" in extras) redirect(`${back}&error=${encodeURIComponent(extras.error ?? "Check the extra lines")}`);
  const term = await prisma.term.findUnique({ where: { id: termId } });
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { enrollments: { where: { yearId, active: true } } },
  });
  if (!student || !term || term.yearId !== yearId) redirect(`${back}&error=${encodeURIComponent("Choose a student and a term")}`);
  const enrollment = student.enrollments[0];
  if (!enrollment) redirect(`${back}&error=${encodeURIComponent("This student is not enrolled for that year.")}`);
  const terms = await prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } });
  const audience = studentAudience(student.enrolledOn, term, terms);
  if (audience === "not_enrolled") redirect(`${back}&error=${encodeURIComponent("This student was not enrolled during that term.")}`);
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const invoiceId = await prisma.$transaction(async (tx) => {
    const fees = await feesForClass(tx, enrollment.classId, termId);
    return createTermInvoice(tx, user.id, {
      student,
      classId: enrollment.classId,
      yearId,
      term,
      terms,
      dueOn: addDays(term.startsOn, settings?.invoiceDueDays ?? 14),
      fees,
      audience,
      extras: extras.lines,
      notes: extras.notes,
    });
  });
  if (!invoiceId.id) {
    redirect(`${back}&error=${encodeURIComponent("There are no fees for this student in that term.")}`);
  }
  revalidatePath("/fees/invoices");
  revalidatePath(`/students/${studentId}`);
  redirect(`/fees/invoices/${invoiceId.id}`);
}

export async function generateFirstTermInvoice(formData: FormData) {
  "use server";
  const user = await requireInvoiceGeneration();
  const applicationId = String(formData.get("applicationId") || "");
  const application = await prisma.admissionApplication.findUnique({
    where: { id: applicationId },
    include: { student: { include: { enrollments: { where: { active: true } } } } },
  });
  if (!application?.student) redirect(`/admissions/${applicationId}?error=${encodeURIComponent("Enroll the student before generating the first-term invoice.")}`);
  const term = await prisma.term.findFirst({ where: { yearId: application.yearId, label: application.termLabel } });
  if (!term) redirect(`/admissions/${applicationId}?error=${encodeURIComponent("The application term was not found.")}`);
  const enrollment = application.student.enrollments.find((item) => item.yearId === application.yearId) ?? application.student.enrollments[0];
  if (!enrollment) redirect(`/admissions/${applicationId}?error=${encodeURIComponent("This student has no class for that year.")}`);
  const terms = await prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } });
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const invoiceId = await prisma.$transaction(async (tx) => {
    const fees = await feesForClass(tx, enrollment.classId, term.id);
    return createTermInvoice(tx, user.id, {
      student: application.student!,
      classId: enrollment.classId,
      yearId: application.yearId,
      term,
      terms,
      dueOn: addDays(term.startsOn, settings?.invoiceDueDays ?? 14),
      fees,
      audience: "new",
    });
  });
  if (!invoiceId.id) {
    redirect(`/admissions/${applicationId}?error=${encodeURIComponent("There are no new-student fees for this class.")}`);
  }
  revalidatePath(`/admissions/${applicationId}`);
  revalidatePath("/fees/invoices");
  redirect(`/fees/invoices/${invoiceId.id}`);
}

async function createTermInvoice(
  tx: Prisma.TransactionClient,
  actorId: string,
  input: {
    student: { id: string; firstName: string; lastName: string; enrolledOn: Date | null };
    classId: string;
    yearId: string;
    term: TermSpan & { label: string; startsOn: Date };
    terms: TermSpan[];
    dueOn: Date;
    fees: { id: string; name: string; amount: number; appliesTo: FeeAppliesTo }[];
    audience: "new" | "returning";
    extras?: { label: string; amount: number; feeItemId: string | null }[];
    notes?: string;
  },
) {
  const lines = [...currentFeeLines(input.fees, input.audience), ...(input.extras ?? [])];
  const existing = await tx.invoice.findFirst({
    where: { studentId: input.student.id, termId: input.term.id, kind: "school_fee", status: { notIn: ["cancelled", "reversed"] } },
    include: { items: true, allocations: { include: { payment: true } } },
  });
  const name = `${input.student.firstName} ${input.student.lastName}`;
  if (!existing) {
    if (lines.length === 0) return { id: null, reason: "empty" as const };
    const number = await nextDocumentNumber(tx, "invoice", new Date());
    const invoice = await tx.invoice.create({
      data: {
        number,
        kind: "school_fee",
        status: "issued",
        studentId: input.student.id,
        yearId: input.yearId,
        termId: input.term.id,
        termLabel: input.term.label,
        issuedOn: new Date(),
        dueOn: input.dueOn,
        notes: input.notes ?? "",
        items: { create: lines.map((line) => ({ label: line.label, amount: line.amount, feeItemId: line.feeItemId })) },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "invoice.generated",
        entityType: "Invoice",
        entityId: invoice.id,
        summary: `${number} for ${name} (${input.audience === "new" ? "new" : "returning"})`,
      },
    });
    return { id: invoice.id, reason: "created" as const };
  }
  const hasPayments = existing.allocations.some((item) => !item.payment.reversedAt && item.amount > 0);
  const plan = planInvoiceUpdate(existing.items, lines, hasPayments);
  if (plan.action === "unchanged") return { id: existing.id, reason: "unchanged" as const };
  if (plan.action === "replace") {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    if (plan.lines.length > 0) {
      await tx.invoiceItem.createMany({
        data: plan.lines.map((line) => ({ invoiceId: existing.id, label: line.label, amount: line.amount, feeItemId: line.feeItemId })),
      });
    }
  } else {
    await tx.invoiceItem.create({
      data: { invoiceId: existing.id, label: plan.line.label, amount: plan.line.amount, feeItemId: plan.line.feeItemId },
    });
  }
  if (input.notes) await tx.invoice.update({ where: { id: existing.id }, data: { notes: input.notes } });
  await refreshInvoiceStatus(tx, existing.id);
  await tx.auditLog.create({
    data: {
      actorId,
      action: "invoice.updated",
      entityType: "Invoice",
      entityId: existing.id,
      summary: `Updated ${existing.number} for ${name} to the current fees`,
    },
  });
  return { id: existing.id, reason: "updated" as const };
}

async function refreshInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, adjustments: true, allocations: { include: { payment: true } } },
  });
  if (!invoice || invoice.status === "cancelled" || invoice.status === "reversed" || invoice.status === "carried_forward") return;
  const balance = invoiceBalance(invoice);
  const status = balance.paid <= 0 ? "issued" : balance.balance <= 0 ? "paid" : "partial";
  if (status !== invoice.status) await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
}

export async function cancelInvoice(formData: FormData) {
  "use server";
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
