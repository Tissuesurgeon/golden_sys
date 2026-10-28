import { randomBytes } from "node:crypto";
import type { PaymentMethod as DbMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { nextDocumentNumber } from "@/lib/audit";
import { dateOnly, isoDate, termId, yearId, yearRange, termRange } from "@/lib/calendar";
import { attendanceTotals, ranksWithTies, showsPosition } from "@/lib/academics";
import { allocationError, invoiceDue } from "@/lib/money";
import type { CurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import type { PaymentMethod, SchoolSettings } from "@/lib/prototype/types";

type Action =
  | { type: "add-student"; student: { id: string; admissionNumber: string; firstName: string; lastName: string; otherNames: string; sex: string; dateOfBirth: string; classId: string; status: string; enrolledOn: string; residentialAddress: string }; guardian: { fullName: string; relationship: string; phone: string; email: string; occupation: string } }
  | { type: "update-student"; student: { id: string; admissionNumber: string; firstName: string; lastName: string; otherNames: string; sex: string; dateOfBirth: string; classId: string; status: string; enrolledOn: string; residentialAddress: string } }
  | { type: "add-guardian"; guardian: { studentId: string; fullName: string; relationship: string; phone: string; email: string; occupation: string; primary: boolean } }
  | { type: "record-payment"; payment: { id: string; studentId: string; date: string; method: PaymentMethod; reference: string; amount: number; allocations: { chargeId: string; amount: number }[] } }
  | { type: "save-marks"; sheetId: string; rows: { studentId: string; scores: Record<string, number | null>; remark: string | null }[] }
  | { type: "submit-marks"; sheetId: string }
  | { type: "return-marks"; sheetId: string; reason: string }
  | { type: "approve-marks"; sheetId: string }
  | { type: "publish-sheet"; sheetId: string }
  | { type: "amend-sheet"; sheetId: string; reason: string }
  | { type: "save-config"; configId: string; components: { id: string; name: string; max: number }[]; status: "draft" | "configured" }
  | { type: "add-config"; year: string; term: string; classId: string; subjectId: string; components: { id: string; name: string; max: number }[] }
  | { type: "upsert-class"; classRoom: { id: string; name: string; level: string; teacherId: string | null } }
  | { type: "upsert-subject"; subject: { id: string; name: string; code: string; levels: string[] } }
  | { type: "invite-staff"; name: string; email: string; role: "administrator" | "bursar" | "teacher" }
  | { type: "update-staff"; staffId: string; role: "administrator" | "bursar" | "teacher"; classIds: string[]; subjectIds: string[]; status: "active" | "invited" }
  | { type: "update-school"; school: SchoolSettings }
  | { type: "add-adjustment"; studentId: string; year: string; term: string; label: string; amount: number; reason: string }
  | { type: "reverse-payment"; paymentId: string; reason: string };

const METHODS: Record<PaymentMethod, DbMethod> = {
  Cash: "cash",
  "Mobile Money": "mobile_money",
  "Bank Transfer": "bank_transfer",
  Other: "other",
};

function dbStatus(status: string) {
  if (status === "enrolled") return "active" as const;
  if (status === "pending" || status === "transferred" || status === "withdrawn" || status === "graduated") return status;
  return "active" as const;
}

async function ensureYear(tx: Prisma.TransactionClient, label: string) {
  const id = yearId(label);
  const range = yearRange(label);
  await tx.academicYear.upsert({
    where: { id },
    create: { id, label, startsOn: range.startsOn, endsOn: range.endsOn },
    update: {},
  });
  for (const [index, term] of ["Term 1", "Term 2", "Term 3"].entries()) {
    const span = termRange(label, term);
    await tx.term.upsert({
      where: { id: termId(label, term) },
      create: { id: termId(label, term), yearId: id, label: term, position: index + 1, startsOn: span.startsOn, endsOn: span.endsOn },
      update: {},
    });
  }
  return id;
}

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityType: string, entityId: string, summary: string) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, summary } });
}

async function refreshInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, allocations: { include: { payment: true } }, adjustments: true },
  });
  if (!invoice || invoice.status === "cancelled" || invoice.status === "reversed" || invoice.status === "carried_forward") return;
  const charges = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const paid = invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0);
  const adjusted = invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0);
  const due = charges + adjusted - paid;
  const status = due <= 0 ? "paid" : paid > 0 ? "partial" : "issued";
  await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
}

async function assertSheetAccess(user: CurrentUser, sheetId: string, write: "enter" | "review") {
  const sheet = await prisma.markSheet.findUnique({ where: { id: sheetId }, include: { config: true } });
  if (!sheet) throw new Error("Mark sheet was not found.");
  if (write === "review") {
    assertCan(user.role, "academics.approve");
    return sheet;
  }
  assertCan(user.role, "academics.write");
  if (user.role === "teacher") {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { staffId: user.staffId ?? "", classId: sheet.config.classId, subjectId: sheet.config.subjectId },
    });
    if (!assignment) throw new Error("This class is not assigned to you.");
  }
  return sheet;
}

function subjectLine(
  item: { rows: { scores: Prisma.JsonValue; remark: string | null }[]; config: { subject: { name: string }; components: Prisma.JsonValue } },
  bands: { min: number; grade: string }[],
) {
  const mark = item.rows[0];
  const components = item.config.components as { id: string; name: string; max: number }[];
  const scores = (mark?.scores ?? {}) as Record<string, number | null>;
  const total = components.reduce((sum, component) => sum + (scores[component.id] ?? 0), 0);
  const missing = components.some((component) => scores[component.id] == null);
  const grade = missing ? null : (bands.find((band) => total >= band.min)?.grade ?? null);
  return { subject: item.config.subject.name, components, scores, total: missing ? null : total, grade, remark: mark?.remark ?? null };
}

async function writeSnapshots(tx: Prisma.TransactionClient, sheetId: string, actorId: string) {
  const sheet = await tx.markSheet.findUnique({
    where: { id: sheetId },
    include: { rows: true, config: { include: { year: true, subject: true, classRoom: true } } },
  });
  if (!sheet) return;
  const bands = await tx.gradingBand.findMany({ orderBy: { min: "desc" } });
  const published = await tx.markSheet.findMany({
    where: {
      status: "published",
      config: { yearId: sheet.config.yearId, termLabel: sheet.config.termLabel, classId: sheet.config.classId },
    },
    include: { rows: true, config: { include: { subject: true } } },
  });
  const totals = new Map<string, number>();
  for (const item of published) {
    for (const mark of item.rows) {
      const line = subjectLine({ ...item, rows: [mark] }, bands);
      if (line.total == null) continue;
      totals.set(mark.studentId, (totals.get(mark.studentId) ?? 0) + line.total);
    }
  }
  const ranked = showsPosition(sheet.config.classRoom.level)
    ? ranksWithTies([...totals].map(([id, total]) => ({ id, total })))
    : new Map<string, number>();
  const term = await tx.term.findFirst({ where: { yearId: sheet.config.yearId, label: sheet.config.termLabel } });
  const classAttendance = term
    ? await tx.attendance.findMany({ where: { classId: sheet.config.classId, termId: term.id } })
    : [];
  const daysOpen = new Set(classAttendance.map((row) => isoDate(row.date))).size;
  for (const row of sheet.rows) {
    const student = await tx.student.findUnique({ where: { id: row.studentId } });
    if (!student) continue;
    const subjects = published.flatMap((item) => {
      const rows = item.rows.filter((mark) => mark.studentId === student.id);
      return rows.length ? [subjectLine({ ...item, rows }, bands)] : [];
    });
    const ownAttendance = classAttendance.filter((item) => item.studentId === student.id);
    const termReport = term
      ? await tx.termReport.findUnique({ where: { studentId_termId: { studentId: student.id, termId: term.id } } })
      : null;
    const latest = await tx.reportCardSnapshot.findFirst({
      where: { studentId: student.id, yearLabel: sheet.config.year.label, termLabel: sheet.config.termLabel },
      orderBy: { version: "desc" },
    });
    await tx.reportCardSnapshot.create({
      data: {
        studentId: student.id,
        yearLabel: sheet.config.year.label,
        termLabel: sheet.config.termLabel,
        version: (latest?.version ?? 0) + 1,
        publishedBy: actorId,
        payload: {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          className: sheet.config.classRoom.name,
          level: sheet.config.classRoom.level,
          position: ranked.get(student.id) ?? null,
          subjects,
          attendance: attendanceTotals(ownAttendance, daysOpen),
          termReport: termReport
            ? { remark: termReport.remark, conduct: termReport.conduct, attitude: termReport.attitude, interest: termReport.interest }
            : null,
        },
      },
    });
  }
  for (const [studentId, position] of ranked) {
    const latest = await tx.reportCardSnapshot.findFirst({
      where: { studentId, yearLabel: sheet.config.year.label, termLabel: sheet.config.termLabel },
      orderBy: { version: "desc" },
    });
    if (!latest) continue;
    const payload = (latest.payload ?? {}) as Record<string, unknown>;
    if (payload.position === position) continue;
    await tx.reportCardSnapshot.update({ where: { id: latest.id }, data: { payload: { ...payload, position } } });
  }
}

export async function applyAction(user: CurrentUser, action: Action): Promise<{ paymentId?: string }> {
  switch (action.type) {
    case "add-student": {
      assertCan(user.role, "students.write");
      const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
      const yearLabel = (await prisma.academicYear.findUnique({ where: { id: settings?.academicYearId ?? "" } }))?.label ?? "2025/2026";
      const term = (await prisma.term.findUnique({ where: { id: settings?.currentTermId ?? "" } }))?.label ?? "Term 1";
      await prisma.$transaction(async (tx) => {
        const taken = await tx.student.findUnique({ where: { admissionNumber: action.student.admissionNumber } });
        if (taken) throw new Error("That admission number is already in use.");
        const year = await ensureYear(tx, yearLabel);
        await tx.student.create({
          data: {
            id: action.student.id,
            admissionNumber: action.student.admissionNumber,
            firstName: action.student.firstName,
            lastName: action.student.lastName,
            otherNames: action.student.otherNames,
            sex: action.student.sex,
            dateOfBirth: dateOnly(action.student.dateOfBirth),
            status: "active",
            enrolledOn: dateOnly(action.student.enrolledOn || isoDate(new Date())),
            residentialAddress: action.student.residentialAddress,
          },
        });
        await tx.classEnrollment.create({ data: { studentId: action.student.id, classId: action.student.classId, yearId: year, active: true } });
        if (action.guardian.fullName.trim()) {
          const guardianId = `${action.student.id}-guardian`;
          await tx.guardian.create({
            data: {
              id: guardianId,
              fullName: action.guardian.fullName.trim(),
              phone: action.guardian.phone,
              email: action.guardian.email,
              occupation: action.guardian.occupation,
            },
          });
          await tx.studentGuardian.create({
            data: { studentId: action.student.id, guardianId, relationship: action.guardian.relationship || "Guardian", primary: true },
          });
        }
        const sheets = await tx.markSheet.findMany({ where: { config: { classId: action.student.classId, yearId: year, termLabel: term } }, include: { config: true } });
        for (const sheet of sheets) {
          const components = sheet.config.components as { id: string }[];
          await tx.markRow.create({
            data: {
              sheetId: sheet.id,
              studentId: action.student.id,
              scores: Object.fromEntries(components.map((component) => [component.id, null])),
            },
          });
        }
        await audit(tx, user.id, "student.created", "Student", action.student.id, `Admitted ${action.student.firstName} ${action.student.lastName}`);
      });
      return {};
    }
    case "update-student": {
      assertCan(user.role, "students.write");
      const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
      await prisma.$transaction(async (tx) => {
        await tx.student.update({
          where: { id: action.student.id },
          data: {
            admissionNumber: action.student.admissionNumber,
            firstName: action.student.firstName,
            lastName: action.student.lastName,
            otherNames: action.student.otherNames,
            sex: action.student.sex,
            dateOfBirth: dateOnly(action.student.dateOfBirth),
            status: dbStatus(action.student.status),
            residentialAddress: action.student.residentialAddress,
          },
        });
        if (settings?.academicYearId && action.student.classId) {
          await tx.classEnrollment.updateMany({ where: { studentId: action.student.id, active: true }, data: { active: false } });
          await tx.classEnrollment.upsert({
            where: { studentId_yearId: { studentId: action.student.id, yearId: settings.academicYearId } },
            create: { studentId: action.student.id, classId: action.student.classId, yearId: settings.academicYearId, active: true },
            update: { classId: action.student.classId, active: true },
          });
        }
        await audit(tx, user.id, "student.updated", "Student", action.student.id, "Updated student record");
      });
      return {};
    }
    case "add-guardian": {
      assertCan(user.role, "students.write");
      const id = `gdn-${Date.now()}`;
      await prisma.$transaction(async (tx) => {
        await tx.guardian.create({
          data: { id, fullName: action.guardian.fullName, phone: action.guardian.phone, email: action.guardian.email, occupation: action.guardian.occupation },
        });
        await tx.studentGuardian.create({
          data: {
            studentId: action.guardian.studentId,
            guardianId: id,
            relationship: action.guardian.relationship,
            primary: action.guardian.primary,
          },
        });
        await audit(tx, user.id, "guardian.linked", "Student", action.guardian.studentId, `Linked ${action.guardian.fullName}`);
      });
      return {};
    }
    case "record-payment": {
      assertCan(user.role, "finance.write");
      if (!Number.isInteger(action.payment.amount) || action.payment.amount <= 0) throw new Error("Enter a positive amount in pesewas.");
      const paymentId = action.payment.id || `pay-${randomBytes(6).toString("hex")}`;
      await prisma.$transaction(async (tx) => {
        const items = await tx.invoiceItem.findMany({
          where: { id: { in: action.payment.allocations.map((item) => item.chargeId) } },
          include: { invoice: true },
        });
        const byInvoice = new Map<string, number>();
        for (const allocation of action.payment.allocations) {
          const item = items.find((entry) => entry.id === allocation.chargeId);
          if (!item || item.invoice.studentId !== action.payment.studentId) throw new Error("A selected charge does not belong to this student.");
          byInvoice.set(item.invoiceId, (byInvoice.get(item.invoiceId) ?? 0) + allocation.amount);
        }
        const checked: { amount: number; remaining: number }[] = [];
        for (const [invoiceId, amount] of byInvoice) {
          const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            include: { items: true, allocations: { include: { payment: true } }, adjustments: true },
          });
          if (!invoice) throw new Error("A selected charge does not belong to this student.");
          const remaining = invoiceDue({
            charges: invoice.items.reduce((sum, item) => sum + item.amount, 0),
            adjustments: invoice.adjustments.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.amount, 0),
            paid: invoice.allocations.filter((item) => !item.payment.reversedAt).reduce((sum, item) => sum + item.amount, 0),
          });
          checked.push({ amount, remaining });
        }
        const problem = allocationError(action.payment.amount, checked);
        if (problem) throw new Error(problem);
        const receiptNumber = await nextDocumentNumber(tx, "receipt", dateOnly(action.payment.date));
        await tx.payment.create({
          data: {
            id: paymentId,
            receiptNumber,
            studentId: action.payment.studentId,
            paidOn: dateOnly(action.payment.date),
            method: METHODS[action.payment.method],
            reference: action.payment.reference,
            amount: action.payment.amount,
            recordedById: user.id,
            note: "Recorded by the school. Not verified by a payment gateway.",
            allocations: { create: [...byInvoice.entries()].map(([invoiceId, amount]) => ({ invoiceId, amount })) },
          },
        });
        for (const invoiceId of byInvoice.keys()) await refreshInvoice(tx, invoiceId);
        await audit(tx, user.id, "payment.recorded", "Payment", paymentId, `Recorded ${receiptNumber}`);
      });
      return { paymentId };
    }
    case "save-marks": {
      const sheet = await assertSheetAccess(user, action.sheetId, "enter");
      if (sheet.status === "published" || sheet.status === "approved" || sheet.status === "submitted") {
        throw new Error("This sheet is locked. Ask an administrator to return or amend it.");
      }
      await prisma.$transaction(async (tx) => {
        for (const row of action.rows) {
          await tx.markRow.upsert({
            where: { sheetId_studentId: { sheetId: sheet.id, studentId: row.studentId } },
            create: { sheetId: sheet.id, studentId: row.studentId, scores: row.scores, remark: row.remark },
            update: { scores: row.scores, remark: row.remark },
          });
        }
        await tx.resultEvent.create({ data: { sheetId: sheet.id, action: "saved", actorId: user.id } });
      });
      return {};
    }
    case "submit-marks": {
      const sheet = await assertSheetAccess(user, action.sheetId, "enter");
      if (sheet.status !== "draft" && sheet.status !== "returned") throw new Error("Only a draft or returned sheet can be submitted.");
      await prisma.markSheet.update({ where: { id: sheet.id }, data: { status: "submitted", returnReason: null } });
      await prisma.resultEvent.create({ data: { sheetId: sheet.id, action: "submitted", actorId: user.id } });
      return {};
    }
    case "return-marks": {
      const sheet = await assertSheetAccess(user, action.sheetId, "review");
      if (!action.reason.trim()) throw new Error("A return needs a comment.");
      await prisma.markSheet.update({ where: { id: sheet.id }, data: { status: "returned", returnReason: action.reason.trim() } });
      await prisma.resultEvent.create({ data: { sheetId: sheet.id, action: "returned", comment: action.reason.trim(), actorId: user.id } });
      return {};
    }
    case "approve-marks": {
      const sheet = await assertSheetAccess(user, action.sheetId, "review");
      if (sheet.status !== "submitted") throw new Error("Only a submitted sheet can be approved.");
      await prisma.markSheet.update({ where: { id: sheet.id }, data: { status: "approved", returnReason: null } });
      await prisma.resultEvent.create({ data: { sheetId: sheet.id, action: "approved", actorId: user.id } });
      return {};
    }
    case "publish-sheet": {
      assertCan(user.role, "academics.publish");
      const sheet = await prisma.markSheet.findUnique({ where: { id: action.sheetId } });
      if (!sheet || sheet.status !== "approved") throw new Error("Approve the sheet before publishing it.");
      await prisma.$transaction(async (tx) => {
        await tx.markSheet.update({ where: { id: sheet.id }, data: { status: "published" } });
        await writeSnapshots(tx, sheet.id, user.id);
        await tx.resultEvent.create({ data: { sheetId: sheet.id, action: "published", actorId: user.id } });
        await audit(tx, user.id, "results.published", "MarkSheet", sheet.id, "Published a mark sheet");
      });
      return {};
    }
    case "amend-sheet": {
      assertCan(user.role, "academics.publish");
      if (!action.reason.trim()) throw new Error("An amendment needs a reason.");
      await prisma.$transaction(async (tx) => {
        await tx.markSheet.update({ where: { id: action.sheetId }, data: { status: "draft", returnReason: action.reason.trim() } });
        await tx.resultEvent.create({ data: { sheetId: action.sheetId, action: "amended", comment: action.reason.trim(), actorId: user.id } });
        await audit(tx, user.id, "results.amended", "MarkSheet", action.sheetId, action.reason.trim());
      });
      return {};
    }
    case "save-config":
    case "add-config": {
      assertCan(user.role, "academics.approve");
      const year = action.type === "add-config" ? action.year : undefined;
      await prisma.$transaction(async (tx) => {
        if (action.type === "save-config") {
          await tx.assessmentConfig.update({
            where: { id: action.configId },
            data: { components: action.components, status: action.status },
          });
          return;
        }
        const yearKey = await ensureYear(tx, action.year);
        const id = `cfg-${action.classId}-${action.subjectId}-${action.term}`.toLowerCase().replace(/\s+/g, "-");
        await tx.assessmentConfig.upsert({
          where: { id },
          create: {
            id,
            yearId: yearKey,
            termLabel: action.term,
            classId: action.classId,
            subjectId: action.subjectId,
            components: action.components,
            status: "configured",
          },
          update: { components: action.components, status: "configured" },
        });
        const existing = await tx.markSheet.findUnique({ where: { id: `sheet-${id}` } });
        if (!existing) {
          const enrolled = await tx.classEnrollment.findMany({ where: { classId: action.classId, yearId: yearKey, active: true } });
          await tx.markSheet.create({
            data: {
              id: `sheet-${id}`,
              configId: id,
              status: "draft",
              rows: {
                create: enrolled.map((enrollment) => ({
                  studentId: enrollment.studentId,
                  scores: Object.fromEntries(action.components.map((component) => [component.id, null])),
                })),
              },
            },
          });
        }
      });
      void year;
      return {};
    }
    case "upsert-class": {
      assertCan(user.role, "settings.manage");
      const id = action.classRoom.id || `cls-${Date.now()}`;
      await prisma.classRoom.upsert({
        where: { id },
        create: { id, name: action.classRoom.name, level: action.classRoom.level, teacherId: action.classRoom.teacherId },
        update: { name: action.classRoom.name, level: action.classRoom.level, teacherId: action.classRoom.teacherId },
      });
      return {};
    }
    case "upsert-subject": {
      assertCan(user.role, "settings.manage");
      const id = action.subject.id || `sub-${Date.now()}`;
      await prisma.subject.upsert({
        where: { id },
        create: { id, name: action.subject.name, code: action.subject.code, levels: action.subject.levels },
        update: { name: action.subject.name, code: action.subject.code, levels: action.subject.levels },
      });
      return {};
    }
    case "invite-staff": {
      assertCan(user.role, "staff.manage");
      const email = action.email.trim().toLowerCase();
      const id = `stf-${Date.now()}`;
      await prisma.$transaction(async (tx) => {
        await tx.staff.create({ data: { id, name: action.name.trim(), email, status: "invited" } });
        await tx.user.create({
          data: {
            email,
            name: action.name.trim(),
            role: action.role,
            active: false,
            staffId: id,
            passwordHash: await hashPassword(randomBytes(18).toString("base64url")),
          },
        });
        await audit(tx, user.id, "staff.invited", "Staff", id, `Invited ${email}`);
      });
      return {};
    }
    case "update-staff": {
      assertCan(user.role, "staff.manage");
      const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
      await prisma.$transaction(async (tx) => {
        await tx.staff.update({ where: { id: action.staffId }, data: { status: action.status } });
        await tx.user.updateMany({
          where: { staffId: action.staffId },
          data: { role: action.role, active: action.status === "active" },
        });
        await tx.teacherAssignment.deleteMany({ where: { staffId: action.staffId } });
        if (settings?.academicYearId) {
          for (const classId of action.classIds) {
            for (const subjectId of action.subjectIds) {
              await tx.teacherAssignment.create({ data: { staffId: action.staffId, yearId: settings.academicYearId, classId, subjectId } });
            }
          }
        }
        await tx.classRoom.updateMany({ where: { teacherId: action.staffId }, data: { teacherId: null } });
        if (action.classIds[0]) await tx.classRoom.update({ where: { id: action.classIds[0] }, data: { teacherId: action.staffId } });
        await audit(tx, user.id, "staff.updated", "Staff", action.staffId, "Updated staff role and assignments");
      });
      return {};
    }
    case "update-school": {
      assertCan(user.role, "settings.manage");
      await prisma.$transaction(async (tx) => {
        const year = await ensureYear(tx, action.school.academicYear);
        const term = termId(action.school.academicYear, action.school.currentTerm);
        await tx.schoolSettings.update({
          where: { id: "school" },
          data: {
            name: action.school.name,
            motto: action.school.motto,
            town: action.school.town,
            region: action.school.region,
            country: action.school.country,
            address: action.school.address,
            phone: action.school.phone,
            email: action.school.email,
            academicYearId: year,
            currentTermId: term,
            enrollmentPolicy: action.school.enrollmentPolicy ?? "full_or_waiver",
            minimumDeposit: action.school.minimumDeposit ?? 0,
            admissionFee: action.school.admissionFee ?? 0,
          },
        });
        await audit(tx, user.id, "school.updated", "SchoolSettings", "school", "Updated school settings");
      });
      return {};
    }
    case "add-adjustment": {
      assertCan(user.role, "finance.write");
      if (!Number.isInteger(action.amount) || action.amount === 0) throw new Error("Enter a non-zero adjustment in pesewas.");
      if (!action.reason.trim()) throw new Error("An adjustment needs a reason.");
      const id = `adj-${Date.now()}`;
      await prisma.adjustment.create({
        data: {
          id,
          studentId: action.studentId,
          yearLabel: action.year,
          termLabel: action.term,
          label: action.label,
          amount: action.amount,
          reason: action.reason.trim(),
          createdById: user.id,
        },
      });
      await prisma.auditLog.create({
        data: { actorId: user.id, action: "adjustment.created", entityType: "Adjustment", entityId: id, summary: action.reason.trim() },
      });
      return {};
    }
    case "reverse-payment": {
      assertCan(user.role, "finance.write");
      if (!action.reason.trim()) throw new Error("A reversal needs a reason.");
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: action.paymentId }, include: { allocations: true } });
        if (!payment || payment.reversedAt) throw new Error("This payment cannot be reversed.");
        await tx.payment.update({ where: { id: payment.id }, data: { reversedAt: new Date() } });
        await tx.reversal.create({ data: { targetType: "Payment", targetId: payment.id, reason: action.reason.trim(), createdById: user.id } });
        for (const allocation of payment.allocations) await refreshInvoice(tx, allocation.invoiceId);
        await audit(tx, user.id, "payment.reversed", "Payment", payment.id, action.reason.trim());
      });
      return {};
    }
    default:
      return {};
  }
}
