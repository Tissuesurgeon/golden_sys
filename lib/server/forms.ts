"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { decideApplication, enrollApplication, grantWaiver, issueAdmissionInvoice, recordAdmissionPayment, saveApplication, saveDocument } from "@/lib/server/admissions";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/calendar";
import { assertCan } from "@/lib/permissions";
import { parseCsv, guardianImportErrors, staffImportErrors, studentImportErrors } from "@/lib/csv";
import { yearId } from "@/lib/calendar";

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : "That action could not be saved.";
  redirect(`/admissions?error=${encodeURIComponent(message)}`);
}

export async function applicationFormAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  let saved = "";
  try {
    saved = await saveApplication(user, {
      id: id || undefined,
      firstName: String(formData.get("firstName") || ""),
      lastName: String(formData.get("lastName") || ""),
      otherNames: String(formData.get("otherNames") || ""),
      sex: String(formData.get("sex") || "Female"),
      dateOfBirth: String(formData.get("dateOfBirth") || ""),
      classId: String(formData.get("classId") || ""),
      address: String(formData.get("address") || ""),
      guardianName: String(formData.get("guardianName") || ""),
      relationship: String(formData.get("relationship") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      submit: formData.get("intent") === "submit",
    });
  } catch (error) {
    fail(error);
  }
  revalidatePath("/admissions");
  redirect(`/admissions/${saved}`);
}

export async function decisionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  try {
    await decideApplication(user, id, String(formData.get("outcome") || "accepted") as "accepted", String(formData.get("reason") || ""));
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Decision failed")}`);
  }
  revalidatePath(`/admissions/${id}`);
}

export async function invoiceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  try {
    await issueAdmissionInvoice(user, id);
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Invoice failed")}`);
  }
  revalidatePath(`/admissions/${id}`);
}

export async function admissionPaymentAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const ghs = Number(formData.get("amount") || 0);
  try {
    await recordAdmissionPayment(user, {
      applicationId: id,
      amount: Math.round(ghs * 100),
      date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
      method: String(formData.get("method") || "cash") as "cash",
      reference: String(formData.get("reference") || ""),
    });
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Payment failed")}`);
  }
  revalidatePath(`/admissions/${id}`);
}

export async function enrollAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  try {
    await enrollApplication(user, id);
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Enrollment failed")}`);
  }
  revalidatePath("/students");
  redirect(`/admissions/${id}`);
}

export async function waiveAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  try {
    await grantWaiver(user, id, String(formData.get("reason") || ""));
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Waiver failed")}`);
  }
  revalidatePath(`/admissions/${id}`);
}

export async function uploadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const file = formData.get("file");
  try {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a document to upload.");
    await saveDocument(user, id, file);
  } catch (error) {
    redirect(`/admissions/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed")}`);
  }
  revalidatePath(`/admissions/${id}`);
}

export async function importStudentsAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user.role, "students.write");
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/students/import?error=Choose%20a%20CSV%20file");
  const parsed = parseCsv(await file.text());
  const [students, classes, settings] = await Promise.all([
    prisma.student.findMany({ select: { admissionNumber: true } }),
    prisma.classRoom.findMany(),
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
  ]);
  const errors = studentImportErrors(
    parsed.rows,
    students.map((student) => student.admissionNumber.toLowerCase()),
    classes.map((room) => room.name),
  );
  if (errors.length || parsed.rows.length === 0) {
    redirect(`/students/import?error=${encodeURIComponent(errors.join(" ") || "The file has no student rows.")}`);
  }
  const year = settings?.academicYearId || yearId("2025/2026");
  await prisma.$transaction(async (tx) => {
    for (const row of parsed.rows) {
      const room = classes.find((item) => item.name === row.className);
      if (!room) continue;
      const id = `stu-${row.admissionNumber.toLowerCase()}`;
      await tx.student.create({
        data: {
          id,
          admissionNumber: row.admissionNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          sex: row.sex,
          dateOfBirth: dateOnly(row.dateOfBirth),
          status: "active",
          enrolledOn: dateOnly(new Date().toISOString().slice(0, 10)),
          residentialAddress: row.address || "",
        },
      });
      await tx.classEnrollment.create({ data: { studentId: id, classId: room.id, yearId: year, active: true } });
      if (row.guardianName) {
        const guardianId = `${id}-guardian`;
        await tx.guardian.create({ data: { id: guardianId, fullName: row.guardianName, phone: row.guardianPhone || "", email: row.guardianEmail || "" } });
        await tx.studentGuardian.create({
          data: { studentId: id, guardianId, relationship: row.relationship || "Guardian", primary: true },
        });
      }
    }
    await tx.auditLog.create({
      data: { actorId: user.id, action: "students.imported", entityType: "Student", entityId: "import", summary: `Imported ${parsed.rows.length} students` },
    });
  });
  revalidatePath("/students");
  redirect("/students");
}

export async function importGuardiansAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user.role, "students.write");
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/students/import?error=Choose%20a%20CSV%20file");
  const parsed = parseCsv(await file.text());
  const students = await prisma.student.findMany({ select: { id: true, admissionNumber: true } });
  const errors = guardianImportErrors(parsed.rows, students.map((student) => student.admissionNumber.toLowerCase()));
  if (errors.length || parsed.rows.length === 0) {
    redirect(`/students/import?error=${encodeURIComponent(errors.join(" ") || "The file has no guardian rows.")}`);
  }
  await prisma.$transaction(async (tx) => {
    for (const row of parsed.rows) {
      const student = students.find((item) => item.admissionNumber.toLowerCase() === row.studentAdmission.toLowerCase());
      if (!student) continue;
      const guardianId = `gdn-${row.phone.replace(/\s+/g, "")}-${student.id}`;
      await tx.guardian.upsert({
        where: { id: guardianId },
        create: { id: guardianId, fullName: row.fullName, phone: row.phone, email: row.email || "" },
        update: { fullName: row.fullName, email: row.email || "" },
      });
      await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId } },
        create: { studentId: student.id, guardianId, relationship: row.relationship, primary: false },
        update: { relationship: row.relationship },
      });
    }
    await tx.auditLog.create({
      data: { actorId: user.id, action: "guardians.imported", entityType: "Guardian", entityId: "import", summary: `Imported ${parsed.rows.length} guardians` },
    });
  });
  revalidatePath("/guardians");
  redirect("/guardians");
}

export async function importStaffAction(formData: FormData) {
  const user = await requireUser();
  assertCan(user.role, "staff.manage");
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/students/import?tab=staff&error=Choose%20a%20CSV%20file");
  const parsed = parseCsv(await file.text());
  const errors = staffImportErrors(parsed.rows);
  if (errors.length || parsed.rows.length === 0) {
    redirect(`/students/import?tab=staff&error=${encodeURIComponent(errors.join(" ") || "The file has no staff rows.")}`);
  }
  await prisma.$transaction(async (tx) => {
    for (const row of parsed.rows) {
      const email = row.email.toLowerCase();
      const existing = await tx.staff.findUnique({ where: { email } });
      if (existing) continue;
      const id = `stf-${email.replace(/[^a-z0-9]/g, "").slice(0, 24)}`;
      await tx.staff.create({ data: { id, name: row.name, email, status: "invited" } });
      await tx.user.create({
        data: {
          email,
          name: row.name,
          role: row.role as "teacher",
          active: false,
          staffId: id,
          passwordHash: await hashPassword(`reset-${id}`),
        },
      });
    }
    await tx.auditLog.create({
      data: { actorId: user.id, action: "staff.imported", entityType: "Staff", entityId: "import", summary: `Imported ${parsed.rows.length} staff` },
    });
  });
  revalidatePath("/staff");
  redirect("/staff");
}

export async function adjustmentFormAction(formData: FormData) {
  const { addAdjustment } = await import("@/lib/server/office-actions");
  const studentId = String(formData.get("studentId") || "");
  const ghs = Number(formData.get("amount") || 0);
  const result = await addAdjustment({
    studentId,
    year: String(formData.get("year") || ""),
    term: String(formData.get("term") || ""),
    label: String(formData.get("label") || "Adjustment"),
    amount: Math.round(ghs * 100),
    reason: String(formData.get("reason") || ""),
  });
  if (result.error) redirect(`/fees/statements/${studentId}?error=${encodeURIComponent(result.error)}`);
  redirect(`/fees/statements/${studentId}`);
}

export async function reversePaymentAction(formData: FormData) {
  const { reversePayment } = await import("@/lib/server/office-actions");
  const paymentId = String(formData.get("paymentId") || "");
  const result = await reversePayment(paymentId, String(formData.get("reason") || ""));
  if (result.error) redirect(`/fees/receipts/${paymentId}?error=${encodeURIComponent(result.error)}`);
  redirect(`/fees/receipts/${paymentId}`);
}
