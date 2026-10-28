"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { applyAction } from "@/lib/server/mutate";

const studentSchema = z.object({
  id: z.string().min(1),
  admissionNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  otherNames: z.string(),
  sex: z.string(),
  dateOfBirth: z.string(),
  classId: z.string(),
  status: z.string(),
  enrolledOn: z.string(),
  residentialAddress: z.string(),
});

async function run(action: Parameters<typeof applyAction>[1]) {
  const user = await requireUser();
  try {
    const result = await applyAction(user, action);
    revalidatePath("/", "layout");
    return { error: "", ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That action could not be saved." };
  }
}

export async function addStudent(input: { student: unknown; guardian: unknown }) {
  const student = studentSchema.parse(input.student);
  const guardian = z.object({ fullName: z.string(), relationship: z.string(), phone: z.string(), email: z.string(), occupation: z.string() }).parse(input.guardian);
  return run({ type: "add-student", student, guardian });
}

export async function updateStudent(student: unknown) {
  return run({ type: "update-student", student: studentSchema.parse(student) });
}

export async function addGuardian(guardian: unknown) {
  const parsed = z.object({
    studentId: z.string(),
    fullName: z.string(),
    relationship: z.string(),
    phone: z.string(),
    email: z.string(),
    occupation: z.string(),
    primary: z.boolean(),
  }).parse(guardian);
  return run({ type: "add-guardian", guardian: parsed });
}

export async function recordPayment(payment: unknown) {
  const parsed = z.object({
    id: z.string(),
    studentId: z.string(),
    date: z.string(),
    method: z.enum(["Cash", "Mobile Money", "Bank Transfer", "Other"]),
    reference: z.string(),
    amount: z.number().int(),
    allocations: z.array(z.object({ chargeId: z.string(), amount: z.number().int() })),
  }).parse(payment);
  return run({ type: "record-payment", payment: parsed });
}

export async function saveMarks(sheetId: string, rows: unknown) {
  const parsed = z.array(z.object({ studentId: z.string(), scores: z.record(z.string(), z.number().nullable()), remark: z.string().nullable() })).parse(rows);
  return run({ type: "save-marks", sheetId, rows: parsed });
}

export async function submitMarks(sheetId: string) {
  return run({ type: "submit-marks", sheetId: z.string().parse(sheetId) });
}

export async function returnMarks(sheetId: string, reason: string) {
  return run({ type: "return-marks", sheetId: z.string().parse(sheetId), reason: z.string().min(1).parse(reason) });
}

export async function approveMarks(sheetId: string) {
  return run({ type: "approve-marks", sheetId: z.string().parse(sheetId) });
}

export async function publishSheet(sheetId: string) {
  return run({ type: "publish-sheet", sheetId: z.string().parse(sheetId) });
}

export async function saveConfig(configId: string, components: unknown, status: "draft" | "configured") {
  const parsed = z.array(z.object({ id: z.string(), name: z.string(), max: z.number() })).parse(components);
  return run({ type: "save-config", configId, components: parsed, status });
}

export async function addConfig(input: { year: string; term: string; classId: string; subjectId: string; components: unknown }) {
  const components = z.array(z.object({ id: z.string(), name: z.string(), max: z.number() })).parse(input.components);
  return run({ type: "add-config", year: input.year, term: input.term, classId: input.classId, subjectId: input.subjectId, components });
}

export async function upsertClass(classRoom: unknown) {
  const parsed = z.object({ id: z.string(), name: z.string(), level: z.string(), teacherId: z.string().nullable() }).parse(classRoom);
  return run({ type: "upsert-class", classRoom: parsed });
}

export async function upsertSubject(subject: unknown) {
  const parsed = z.object({ id: z.string(), name: z.string(), code: z.string(), levels: z.array(z.string()) }).parse(subject);
  return run({ type: "upsert-subject", subject: parsed });
}

export async function inviteStaff(input: { name: string; email: string; role: "administrator" | "bursar" | "teacher" }) {
  const parsed = z.object({ name: z.string().min(1), email: z.string().email(), role: z.enum(["administrator", "bursar", "teacher"]) }).parse(input);
  return run({ type: "invite-staff", ...parsed });
}

export async function updateStaff(input: { staffId: string; role: "administrator" | "bursar" | "teacher"; classIds: string[]; subjectIds: string[]; status: "active" | "invited" }) {
  const parsed = z.object({
    staffId: z.string(),
    role: z.enum(["administrator", "bursar", "teacher"]),
    classIds: z.array(z.string()),
    subjectIds: z.array(z.string()),
    status: z.enum(["active", "invited"]),
  }).parse(input);
  return run({ type: "update-staff", ...parsed });
}

export async function updateSchool(school: unknown) {
  const parsed = z.object({
    name: z.string(),
    motto: z.string(),
    town: z.string(),
    region: z.string(),
    country: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    academicYear: z.string(),
    currentTerm: z.string(),
    years: z.array(z.string()),
    terms: z.array(z.string()),
    grading: z.array(z.object({ min: z.number(), grade: z.string(), label: z.string() })),
    enrollmentPolicy: z.enum(["full_or_waiver", "minimum_deposit", "waiver_only"]).optional(),
    minimumDeposit: z.number().optional(),
    admissionFee: z.number().optional(),
  }).parse(school);
  return run({ type: "update-school", school: parsed });
}

export async function addAdjustment(input: { studentId: string; year: string; term: string; label: string; amount: number; reason: string }) {
  const parsed = z.object({
    studentId: z.string(),
    year: z.string(),
    term: z.string(),
    label: z.string(),
    amount: z.number().int(),
    reason: z.string(),
  }).parse(input);
  return run({ type: "add-adjustment", ...parsed });
}

export async function reversePayment(paymentId: string, reason: string) {
  return run({ type: "reverse-payment", paymentId: z.string().parse(paymentId), reason: z.string().parse(reason) });
}
