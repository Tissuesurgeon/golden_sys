import type { Prisma } from "@prisma/client";
import { currentFeeLines } from "@/lib/bills";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { addDays, studentAudience, type FeeAppliesTo } from "@/lib/invoices";
import { requireInvoiceGeneration } from "@/lib/server/guard";

const activeInvoice = { notIn: ["cancelled", "reversed"] as ("cancelled" | "reversed")[] };

export async function feesForClass(db: Prisma.TransactionClient | typeof prisma, classId: string, termId: string) {
  const items = await db.feeItem.findMany({
    where: { active: true, kind: "school_fee" },
    include: { schedules: { where: { classId, termId } }, classes: true },
  });
  return items
    .filter((item) => item.classes.length === 0 || item.classes.some((link) => link.classId === classId))
    .map((item) => ({ id: item.id, name: item.name, amount: item.schedules[0]?.amount ?? item.amount, appliesTo: item.appliesTo as FeeAppliesTo }));
}

export async function previewTermInvoices(yearId: string, termId: string, classId: string, cohort: string) {
  await requireInvoiceGeneration();
  const term = await prisma.term.findUnique({ where: { id: termId }, include: { year: true } });
  if (!term || term.yearId !== yearId) return [];
  const audience = cohort === "new" || cohort === "returning" ? cohort : "both";
  const [classes, terms, settings, existing] = await Promise.all([
    prisma.classRoom.findMany({ where: classId && classId !== "all" ? { id: classId } : undefined, orderBy: { name: "asc" } }),
    prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } }),
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
    prisma.invoice.findMany({ where: { termId, kind: "school_fee", status: activeInvoice }, select: { studentId: true } }),
  ]);
  const taken = new Set(existing.map((invoice) => invoice.studentId).filter((id): id is string => Boolean(id)));
  const rows = [];
  for (const room of classes) {
    const students = await prisma.student.findMany({
      where: { status: "active", enrollments: { some: { classId: room.id, yearId, active: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const fees = await feesForClass(prisma, room.id, termId);
    for (const student of students) {
      const group = studentAudience(student.enrolledOn, term, terms);
      if (group === "not_enrolled") continue;
      if (audience !== "both" && group !== audience) continue;
      const lines = currentFeeLines(fees, group);
      rows.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        className: room.name,
        audience: group,
        alreadyInvoiced: taken.has(student.id),
        lines,
        total: lines.reduce((sum, line) => sum + line.amount, 0),
        dueOn: isoDate(addDays(term.startsOn, settings?.invoiceDueDays ?? 14)),
      });
    }
  }
  return rows;
}

export async function previewStudentInvoice(studentId: string, yearId: string, termId: string) {
  await requireInvoiceGeneration();
  const [student, term, terms] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { enrollments: { where: { yearId, active: true }, include: { classRoom: true } } },
    }),
    prisma.term.findUnique({ where: { id: termId } }),
    prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } }),
  ]);
  if (!student || !term || term.yearId !== yearId) return null;
  const enrollment = student.enrollments[0];
  if (!enrollment) return { error: "This student is not enrolled for that year." };
  const audience = studentAudience(student.enrolledOn, term, terms);
  if (audience === "not_enrolled") return { error: "This student was not enrolled during that term." };
  const existing = await prisma.invoice.findFirst({
    where: { studentId, termId, kind: "school_fee", status: activeInvoice },
    select: { id: true, number: true },
  });
  const lines = currentFeeLines(await feesForClass(prisma, enrollment.classId, termId), audience);
  return {
    studentId,
    name: `${student.firstName} ${student.lastName}`,
    admissionNumber: student.admissionNumber,
    className: enrollment.classRoom.name,
    audience,
    alreadyInvoiced: Boolean(existing),
    existingNumber: existing?.number ?? "",
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}
