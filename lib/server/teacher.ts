"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { dateOnly } from "@/lib/calendar";
import { prisma } from "@/lib/db";

async function classTeacher(classId: string) {
  const user = await requireUser();
  if (user.role === "administrator") return user;
  if (user.role !== "teacher" || !user.staffId) throw new Error("This class is not yours.");
  const room = await prisma.classRoom.findUnique({ where: { id: classId } });
  if (!room || room.teacherId !== user.staffId) throw new Error("This class is not yours.");
  return user;
}

const attendanceInput = z.object({
  classId: z.string(),
  termId: z.string(),
  date: z.string(),
  rows: z.array(z.object({ studentId: z.string(), status: z.enum(["present", "absent", "late", "excused"]), note: z.string() })),
});

export async function saveAttendance(input: z.infer<typeof attendanceInput>) {
  const parsed = attendanceInput.parse(input);
  const user = await classTeacher(parsed.classId);
  const term = await prisma.term.findUnique({ where: { id: parsed.termId } });
  if (!term) throw new Error("Choose a term.");
  const day = dateOnly(parsed.date);
  if (day < term.startsOn || day > term.endsOn) throw new Error("That date is outside the current term.");
  const enrolled = await prisma.classEnrollment.findMany({
    where: { classId: parsed.classId, yearId: term.yearId, active: true },
    select: { studentId: true },
  });
  const allowed = new Set(enrolled.map((row) => row.studentId));
  await prisma.$transaction(
    parsed.rows
      .filter((row) => allowed.has(row.studentId))
      .map((row) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: row.studentId, date: day } },
          create: {
            studentId: row.studentId,
            classId: parsed.classId,
            termId: term.id,
            date: day,
            status: row.status,
            note: row.note,
            recordedById: user.id,
          },
          update: { classId: parsed.classId, termId: term.id, status: row.status, note: row.note, recordedById: user.id },
        }),
      ),
  );
  revalidatePath("/attendance");
  revalidatePath("/report-cards");
}

const reportInput = z.object({
  classId: z.string(),
  termId: z.string(),
  rows: z.array(
    z.object({
      studentId: z.string(),
      remark: z.string(),
      conduct: z.string(),
      attitude: z.string(),
      interest: z.string(),
    }),
  ),
});

export async function saveTermReports(input: z.infer<typeof reportInput>) {
  const parsed = reportInput.parse(input);
  const user = await classTeacher(parsed.classId);
  const enrolled = await prisma.classEnrollment.findMany({
    where: { classId: parsed.classId, active: true },
    select: { studentId: true },
  });
  const allowed = new Set(enrolled.map((row) => row.studentId));
  await prisma.$transaction(
    parsed.rows
      .filter((row) => allowed.has(row.studentId))
      .map((row) =>
        prisma.termReport.upsert({
          where: { studentId_termId: { studentId: row.studentId, termId: parsed.termId } },
          create: { ...row, termId: parsed.termId, updatedById: user.id },
          update: { remark: row.remark, conduct: row.conduct, attitude: row.attitude, interest: row.interest, updatedById: user.id },
        }),
      ),
  );
  revalidatePath("/my");
  revalidatePath("/report-cards");
}

export async function setAssessmentDeadline(configId: string, deadline: string) {
  const user = await requireUser();
  if (user.role !== "administrator") throw new Error("Only an administrator can set a deadline.");
  z.string().parse(configId);
  await prisma.assessmentConfig.update({
    where: { id: configId },
    data: { deadline: deadline ? dateOnly(deadline) : null },
  });
  revalidatePath("/my");
  revalidatePath("/academics/assessments");
}

export async function changePassword(current: string, next: string) {
  const user = await requireUser();
  if (next.length < 8) return { error: "Use at least 8 characters." };
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !(await verifyPassword(row.passwordHash, current))) return { error: "The current password is not correct." };
  const { cookies } = await import("next/headers");
  const { hashToken } = await import("@/lib/auth");
  const token = (await cookies()).get("gcs_session")?.value;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId: user.id, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) } }),
  ]);
  return { error: "" };
}
