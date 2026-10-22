import type { PaymentMethod as DbMethod, Prisma, StudentStatus as DbStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isoDate } from "@/lib/calendar";
import type { CurrentUser } from "@/lib/auth";
import type { PaymentMethod, PrototypeState, SheetStatus, StudentStatus } from "@/lib/prototype/types";

const METHOD: Record<DbMethod, PaymentMethod> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

function studentStatus(status: DbStatus): StudentStatus {
  if (status === "active") return "enrolled";
  if (status === "pending") return "pending";
  if (status === "transferred") return "transferred";
  if (status === "graduated") return "graduated";
  return "withdrawn";
}

export async function loadSnapshot(user: CurrentUser): Promise<PrototypeState> {
  const [settings, years, classes, subjects, bands, staff, students, links, invoices, payments, adjustments, configs, sheets, assignments] =
    await Promise.all([
      prisma.schoolSettings.findUnique({ where: { id: "school" } }),
      prisma.academicYear.findMany({ include: { terms: true }, orderBy: { label: "desc" } }),
      prisma.classRoom.findMany({ orderBy: { name: "asc" } }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.gradingBand.findMany({ orderBy: { sort: "asc" } }),
      prisma.staff.findMany({ include: { user: true, assignments: true } }),
      prisma.student.findMany({ include: { enrollments: { where: { active: true } } } }),
      prisma.studentGuardian.findMany({ include: { guardian: true } }),
      prisma.invoice.findMany({
        where: { status: { notIn: ["cancelled", "reversed"] } },
        include: { items: true, year: true },
      }),
      prisma.payment.findMany({ where: { reversedAt: null }, include: { allocations: true } }),
      prisma.adjustment.findMany({ where: { reversedAt: null } }),
      prisma.assessmentConfig.findMany({ include: { year: true } }),
      prisma.markSheet.findMany({ include: { rows: true } }),
      prisma.teacherAssignment.findMany(),
    ]);

  if (!settings) throw new Error("School settings have not been seeded.");

  const currentYear = years.find((year) => year.id === settings.academicYearId) ?? years[0];
  const currentTerm = currentYear?.terms.find((term) => term.id === settings.currentTermId) ?? currentYear?.terms[0];

  const staffView = staff.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: (member.user?.role ?? "teacher") as PrototypeState["staff"][number]["role"],
    status: (member.status === "invited" ? "invited" : "active") as "active" | "invited",
    classIds: [...new Set(member.assignments.map((item) => item.classId))],
    subjectIds: [...new Set(member.assignments.map((item) => item.subjectId))],
  }));

  let visibleStudents = students;
  let visibleSheets = sheets;
  let visibleConfigs = configs;
  let visibleStaff = staffView;
  const teacher = user.role === "teacher";
  const bursar = user.role === "bursar";

  if (teacher && user.staffId) {
    const mine = assignments.filter((item) => item.staffId === user.staffId);
    const classIds = new Set(mine.map((item) => item.classId));
    const keys = new Set(mine.map((item) => `${item.classId}:${item.subjectId}`));
    visibleStudents = students.filter((student) => student.enrollments.some((enrollment) => classIds.has(enrollment.classId)));
    const allowedConfigs = new Set(
      configs.filter((config) => keys.has(`${config.classId}:${config.subjectId}`)).map((config) => config.id),
    );
    visibleConfigs = configs.filter((config) => allowedConfigs.has(config.id));
    visibleSheets = sheets.filter((sheet) => allowedConfigs.has(sheet.configId));
    visibleStaff = staffView.filter((member) => member.id === user.staffId);
  }

  if (bursar) {
    visibleConfigs = [];
    visibleSheets = [];
  }

  const studentIds = new Set(visibleStudents.map((student) => student.id));
  const showMoney = user.role === "administrator" || user.role === "bursar";

  const charges = showMoney
    ? invoices
        .filter((invoice) => invoice.studentId && studentIds.has(invoice.studentId))
        .flatMap((invoice) =>
          invoice.items.map((item) => ({
            id: item.id,
            studentId: invoice.studentId as string,
            year: invoice.year?.label ?? currentYear?.label ?? "",
            term: invoice.termLabel,
            label: item.label,
            amount: item.amount,
            issuedOn: isoDate(invoice.issuedOn),
          })),
        )
    : [];

  const capacity = new Map(invoices.flatMap((invoice) => invoice.items.map((item) => [item.id, item.amount])));
  const paymentView = showMoney
    ? payments
        .filter((payment) => payment.studentId && studentIds.has(payment.studentId))
        .sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime() || a.receiptNumber.localeCompare(b.receiptNumber))
        .map((payment) => ({
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          studentId: payment.studentId as string,
          date: isoDate(payment.paidOn),
          method: METHOD[payment.method],
          reference: payment.reference,
          amount: payment.amount,
          allocations: payment.allocations.flatMap((allocation) => {
            const invoice = invoices.find((item) => item.id === allocation.invoiceId);
            if (!invoice) return [];
            let remaining = allocation.amount;
            const parts: { chargeId: string; amount: number }[] = [];
            for (const item of invoice.items) {
              if (remaining <= 0) break;
              const room = capacity.get(item.id) ?? 0;
              const share = Math.min(remaining, room);
              if (share <= 0) continue;
              parts.push({ chargeId: item.id, amount: share });
              capacity.set(item.id, room - share);
              remaining -= share;
            }
            return parts;
          }),
          recordedBy: payment.recordedById,
          sample: false,
        }))
    : [];

  const state: PrototypeState = {
    sessionStaffId: user.staffId,
    year: currentYear?.label ?? "2025/2026",
    term: currentTerm?.label ?? "Term 1",
    students: visibleStudents.map((student) => ({
      id: student.id,
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      sex: student.sex === "Male" ? "Male" : "Female",
      dateOfBirth: isoDate(student.dateOfBirth),
      classId: student.enrollments[0]?.classId ?? "",
      status: studentStatus(student.status),
      enrolledOn: student.enrolledOn ? isoDate(student.enrolledOn) : "",
      residentialAddress: student.residentialAddress,
    })),
    guardians: links
      .filter((link) => studentIds.has(link.studentId))
      .map((link) => ({
        id: link.id,
        studentId: link.studentId,
        fullName: link.guardian.fullName,
        relationship: link.relationship,
        phone: link.guardian.phone,
        email: link.guardian.email,
        occupation: link.guardian.occupation,
        primary: link.primary,
      })),
    classes: classes.map((room) => ({
      id: room.id,
      name: room.name,
      level: room.level as "KG" | "Primary" | "JHS",
      teacherId: room.teacherId,
    })),
    subjects: subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      levels: subject.levels as Array<"KG" | "Primary" | "JHS">,
    })),
    staff: visibleStaff,
    charges,
    adjustments: showMoney
      ? adjustments
          .filter((item) => item.studentId && studentIds.has(item.studentId))
          .map((item) => ({
            id: item.id,
            studentId: item.studentId as string,
            year: item.yearLabel,
            term: item.termLabel,
            label: item.label,
            amount: item.amount,
            date: isoDate(item.createdAt),
          }))
      : [],
    payments: paymentView,
    school: {
      name: settings.name,
      motto: settings.motto,
      town: settings.town,
      region: settings.region,
      country: settings.country,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      academicYear: currentYear?.label ?? "",
      currentTerm: currentTerm?.label ?? "Term 1",
      years: years.map((year) => year.label),
      terms: ["Term 1", "Term 2", "Term 3"],
      grading: bands.map((band) => ({ min: band.min, grade: band.grade, label: band.label })),
      enrollmentPolicy: settings.enrollmentPolicy,
      minimumDeposit: settings.minimumDeposit,
      admissionFee: settings.admissionFee,
    },
    configs: visibleConfigs.map((config) => ({
      id: config.id,
      year: config.year.label,
      term: config.termLabel,
      classId: config.classId,
      subjectId: config.subjectId,
      components: config.components as Prisma.JsonArray as PrototypeState["configs"][number]["components"],
      status: config.status === "configured" ? "configured" : "draft",
    })),
    sheets: visibleSheets.map((sheet) => ({
      id: sheet.id,
      configId: sheet.configId,
      status: sheet.status as SheetStatus,
      returnReason: sheet.returnReason,
      rows: sheet.rows.map((row) => ({
        studentId: row.studentId,
        scores: row.scores as Record<string, number | null>,
        remark: row.remark,
      })),
    })),
    receiptSequence: payments.length,
  };

  return state;
}
