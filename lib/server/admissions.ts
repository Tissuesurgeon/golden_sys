import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/audit";
import { dateOnly, isoDate } from "@/lib/calendar";
import { enrollmentAllowed } from "@/lib/enrollment";
import type { CurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { privateStorageDir } from "@/lib/storage";

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityType: string, entityId: string, summary: string) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, summary } });
}

export async function saveApplication(
  user: CurrentUser,
  input: {
    id?: string;
    firstName: string;
    lastName: string;
    otherNames: string;
    sex: string;
    dateOfBirth: string;
    classId: string;
    address: string;
    guardianName: string;
    relationship: string;
    phone: string;
    email: string;
    submit: boolean;
  },
) {
  assertCan(user.role, "admissions.manage");
  if (!input.firstName.trim() || !input.lastName.trim() || !input.classId || !input.dateOfBirth) {
    throw new Error("Name, date of birth, and class are required.");
  }
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  if (!settings?.academicYearId) throw new Error("Set the current academic year first.");
  const term = await prisma.term.findUnique({ where: { id: settings.currentTermId ?? "" } });
  const id = await prisma.$transaction(async (tx) => {
    const existing = input.id ? await tx.admissionApplication.findUnique({ where: { id: input.id } }) : null;
    if (existing && existing.status !== "draft") throw new Error("Only a draft application can be edited.");
    const number = existing?.number ?? (await nextNumber(tx, "application", "APP-"));
    const status = input.submit ? "submitted" : "draft";
    const saved = existing
      ? await tx.admissionApplication.update({
          where: { id: existing.id },
          data: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            otherNames: input.otherNames.trim(),
            sex: input.sex,
            dateOfBirth: dateOnly(input.dateOfBirth),
            intendedClassId: input.classId,
            address: input.address.trim(),
            status,
            submittedAt: input.submit ? new Date() : null,
          },
        })
      : await tx.admissionApplication.create({
          data: {
            number,
            status,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            otherNames: input.otherNames.trim(),
            sex: input.sex,
            dateOfBirth: dateOnly(input.dateOfBirth),
            intendedClassId: input.classId,
            yearId: settings.academicYearId!,
            termLabel: term?.label ?? "Term 1",
            address: input.address.trim(),
            submittedAt: input.submit ? new Date() : null,
          },
        });
    await tx.applicationGuardian.deleteMany({ where: { applicationId: saved.id } });
    if (input.guardianName.trim()) {
      await tx.applicationGuardian.create({
        data: {
          applicationId: saved.id,
          fullName: input.guardianName.trim(),
          relationship: input.relationship || "Guardian",
          phone: input.phone.trim(),
          email: input.email.trim(),
          primary: true,
        },
      });
    }
    await audit(tx, user.id, input.submit ? "application.submitted" : "application.saved", "Application", saved.id, saved.number);
    return saved.id;
  });
  return id;
}

export async function decideApplication(user: CurrentUser, id: string, outcome: ApplicationStatus, reason: string) {
  assertCan(user.role, "admissions.manage");
  if (!reason.trim()) throw new Error("A decision needs a reason.");
  const allowed: ApplicationStatus[] = ["accepted", "waitlisted", "rejected", "deferred", "under_review"];
  if (!allowed.includes(outcome)) throw new Error("That decision is not available.");
  await prisma.$transaction(async (tx) => {
    const application = await tx.admissionApplication.findUnique({ where: { id } });
    if (!application || application.status === "enrolled" || application.status === "draft") {
      throw new Error("Submit the application before recording a decision.");
    }
    await tx.admissionApplication.update({ where: { id }, data: { status: outcome } });
    await tx.admissionDecision.create({ data: { applicationId: id, outcome, reason: reason.trim(), decidedById: user.id } });
    await audit(tx, user.id, "application.decided", "Application", id, `${outcome}: ${reason.trim()}`);
  });
}

export async function issueAdmissionInvoice(user: CurrentUser, id: string) {
  assertCan(user.role, "admissions.manage");
  await prisma.$transaction(async (tx) => {
    const application = await tx.admissionApplication.findUnique({ where: { id }, include: { invoices: true } });
    if (!application) throw new Error("Application was not found.");
    if (application.status !== "accepted" && application.status !== "enrolled") throw new Error("Accept the application before issuing an invoice.");
    if (application.invoices.some((invoice) => invoice.status !== "cancelled" && invoice.status !== "reversed")) {
      throw new Error("An admission invoice already exists.");
    }
    const fees = await tx.feeItem.findMany({ where: { kind: "admission", active: true } });
    const settings = await tx.schoolSettings.findUnique({ where: { id: "school" } });
    const items = fees.length ? fees.map((fee) => ({ label: fee.name, amount: fee.amount, feeItemId: fee.id })) : [{ label: "Admission fee", amount: settings?.admissionFee ?? 0, feeItemId: null }];
    if (items.reduce((sum, item) => sum + item.amount, 0) <= 0) throw new Error("Set an admission fee before issuing an invoice.");
    const number = await nextNumber(tx, "invoice", "INV-");
    await tx.invoice.create({
      data: {
        number,
        kind: "admission",
        status: "issued",
        applicationId: id,
        yearId: application.yearId,
        termLabel: application.termLabel,
        issuedOn: dateOnly(isoDate(new Date())),
        items: { create: items },
      },
    });
    await audit(tx, user.id, "invoice.issued", "Application", id, number);
  });
}

export async function recordAdmissionPayment(
  user: CurrentUser,
  input: { applicationId: string; amount: number; date: string; method: "cash" | "mobile_money" | "bank_transfer" | "other"; reference: string },
) {
  assertCan(user.role, "admissions.pay");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("Enter a positive amount.");
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { applicationId: input.applicationId, kind: "admission", status: { notIn: ["cancelled", "reversed"] } },
      include: { items: true, allocations: { include: { payment: true } }, adjustments: true },
    });
    if (!invoice) throw new Error("Issue an admission invoice first.");
    const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const paid = invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const adjusted = invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const due = Math.max(0, total + adjusted - paid);
    const allocate = Math.min(due, input.amount);
    const receiptNumber = await nextNumber(tx, "receipt", "RCT-");
    const paymentId = `pay-${randomBytes(6).toString("hex")}`;
    await tx.payment.create({
      data: {
        id: paymentId,
        receiptNumber,
        applicationId: input.applicationId,
        paidOn: dateOnly(input.date),
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        recordedById: user.staffId ?? user.id,
        note: "Recorded by the school. Not verified by a payment gateway.",
        allocations: allocate > 0 ? { create: [{ invoiceId: invoice.id, amount: allocate }] } : undefined,
      },
    });
    const nextPaid = paid + allocate;
    const nextDue = total + adjusted - nextPaid;
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: nextDue <= 0 ? "paid" : "partial" } });
    await audit(tx, user.id, "payment.recorded", "Payment", paymentId, receiptNumber);
  });
}

export async function enrollApplication(user: CurrentUser, id: string) {
  assertCan(user.role, "admissions.manage");
  await prisma.$transaction(async (tx) => {
    const application = await tx.admissionApplication.findUnique({
      where: { id },
      include: {
        guardians: true,
        intendedClass: true,
        invoices: { include: { items: true, allocations: { include: { payment: true } }, adjustments: true } },
        student: true,
      },
    });
    if (!application) throw new Error("Application was not found.");
    if (application.status === "enrolled" || application.student) throw new Error("This application is already enrolled.");
    if (application.status !== "accepted") throw new Error("Only an accepted application can be enrolled.");
    const invoice = application.invoices.find((item) => item.status !== "cancelled" && item.status !== "reversed");
    if (!invoice) throw new Error("Issue an admission invoice before enrollment.");
    const settings = await tx.schoolSettings.findUnique({ where: { id: "school" } });
    const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const paid = invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const adjustments = invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const allowed = enrollmentAllowed({
      policy: settings?.enrollmentPolicy ?? "full_or_waiver",
      total,
      paid,
      adjustments,
      minimumDeposit: settings?.minimumDeposit ?? 0,
    });
    if (!allowed) throw new Error("Enrollment is blocked until the admission fee is paid or waived.");
    const admissionNumber = await nextNumber(tx, "admission", "GCS-");
    const studentId = `stu-${randomBytes(6).toString("hex")}`;
    await tx.student.create({
      data: {
        id: studentId,
        admissionNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        otherNames: application.otherNames,
        sex: application.sex,
        dateOfBirth: application.dateOfBirth,
        status: "active",
        enrolledOn: dateOnly(isoDate(new Date())),
        residentialAddress: application.address,
        applicationId: application.id,
      },
    });
    await tx.classEnrollment.create({ data: { studentId, classId: application.intendedClassId, yearId: application.yearId, active: true } });
    for (const guardian of application.guardians) {
      const existing = guardian.phone
        ? await tx.guardian.findFirst({ where: { phone: guardian.phone } })
        : guardian.email
          ? await tx.guardian.findFirst({ where: { email: guardian.email } })
          : null;
      const guardianId = existing?.id ?? `gdn-${randomBytes(4).toString("hex")}`;
      if (!existing) {
        await tx.guardian.create({
          data: { id: guardianId, fullName: guardian.fullName, phone: guardian.phone, email: guardian.email, occupation: guardian.occupation },
        });
      }
      await tx.studentGuardian.create({
        data: { studentId, guardianId, relationship: guardian.relationship, primary: guardian.primary },
      });
    }
    await tx.invoice.updateMany({ where: { applicationId: application.id }, data: { studentId } });
    await tx.payment.updateMany({ where: { applicationId: application.id }, data: { studentId } });
    await tx.admissionApplication.update({ where: { id: application.id }, data: { status: "enrolled" } });
    await audit(tx, user.id, "student.enrolled", "Student", studentId, `${application.number} enrolled as ${admissionNumber}`);
  });
}

export async function grantWaiver(user: CurrentUser, applicationId: string, reason: string) {
  assertCan(user.role, "admissions.manage");
  if (!reason.trim()) throw new Error("A waiver needs a reason.");
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { applicationId, kind: "admission", status: { notIn: ["cancelled", "reversed"] } },
      include: { items: true, year: true, allocations: { include: { payment: true } }, adjustments: true },
    });
    if (!invoice) throw new Error("Issue an admission invoice before waiving it.");
    const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const paid = invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const adjusted = invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
    const due = total + adjusted - paid;
    if (due <= 0) throw new Error("This invoice has nothing left to waive.");
    await tx.adjustment.create({
      data: {
        id: `adj-${randomBytes(4).toString("hex")}`,
        invoiceId: invoice.id,
        yearLabel: invoice.year?.label ?? "",
        termLabel: invoice.termLabel,
        label: "Admission waiver",
        amount: -due,
        reason: reason.trim(),
        createdById: user.id,
      },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "paid" } });
    await audit(tx, user.id, "invoice.waived", "Invoice", invoice.id, reason.trim());
  });
}

export async function saveDocument(user: CurrentUser, applicationId: string, file: File) {
  assertCan(user.role, "admissions.manage");
  if (file.size > 8_000_000) throw new Error("Documents must be 8 MB or smaller.");
  const storedName = `${randomBytes(16).toString("hex")}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const directory = privateStorageDir();
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(/*turbopackIgnore: true*/ directory, storedName), bytes);
  await prisma.document.create({
    data: {
      ownerType: "application",
      ownerId: applicationId,
      filename: file.name,
      storedName,
      mime: file.type || "application/octet-stream",
      size: file.size,
      uploadedById: user.id,
    },
  });
}
