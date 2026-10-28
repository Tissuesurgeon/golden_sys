import { PrismaClient, type Prisma } from "@prisma/client";
import argon2 from "argon2";
import { createInitialState } from "../lib/prototype/data";
import { dateOnly, termId, termRange, yearId, yearRange } from "../lib/calendar";

const prisma = new PrismaClient();

const TERMS = ["Term 1", "Term 2", "Term 3"];

async function wipe() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.reportCardSnapshot.deleteMany(),
    prisma.resultEvent.deleteMany(),
    prisma.markRow.deleteMany(),
    prisma.markSheet.deleteMany(),
    prisma.assessmentConfig.deleteMany(),
    prisma.paymentAllocation.deleteMany(),
    prisma.reversal.deleteMany(),
    prisma.adjustment.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.document.deleteMany(),
    prisma.admissionDecision.deleteMany(),
    prisma.applicationGuardian.deleteMany(),
    prisma.admissionApplication.deleteMany(),
    prisma.studentGuardian.deleteMany(),
    prisma.classEnrollment.deleteMany(),
    prisma.teacherAssignment.deleteMany(),
    prisma.feeItemClass.deleteMany(),
    prisma.feeItem.deleteMany(),
    prisma.session.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
    prisma.student.deleteMany(),
    prisma.guardian.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.classRoom.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.term.deleteMany(),
    prisma.academicYear.deleteMany(),
    prisma.gradingBand.deleteMany(),
    prisma.counter.deleteMany(),
    prisma.schoolSettings.deleteMany(),
  ]);
}

async function seedStructure(tx: Prisma.TransactionClient, yearLabel: string, termLabel: string) {
  const school = {
    name: "Golden Child School",
    motto: "KNOWLEDGE IS POWER",
    town: "Koforidua",
    region: "Eastern Region",
    country: "Ghana",
    address: "P.O. Box KN 214, Koforidua",
    phone: "+233 34 000 2140",
    email: "office@goldenchild.example",
  };
  const id = yearId(yearLabel);
  const range = yearRange(yearLabel);
  await tx.academicYear.create({ data: { id, label: yearLabel, startsOn: range.startsOn, endsOn: range.endsOn } });
  for (const [index, term] of TERMS.entries()) {
    const span = termRange(yearLabel, term);
    await tx.term.create({
      data: { id: termId(yearLabel, term), yearId: id, label: term, position: index + 1, startsOn: span.startsOn, endsOn: span.endsOn },
    });
  }
  await tx.schoolSettings.create({
    data: {
      ...school,
      academicYearId: id,
      currentTermId: termId(yearLabel, termLabel),
      enrollmentPolicy: "full_or_waiver",
      minimumDeposit: 0,
      admissionFee: 50000,
    },
  });
  const bands = [
    { min: 80, grade: "A", label: "Excellent" },
    { min: 70, grade: "B", label: "Very good" },
    { min: 60, grade: "C", label: "Good" },
    { min: 50, grade: "D", label: "Credit" },
    { min: 40, grade: "E", label: "Pass" },
    { min: 0, grade: "F", label: "Fail" },
  ];
  for (const [index, band] of bands.entries()) {
    await tx.gradingBand.create({ data: { ...band, sort: index } });
  }
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@goldenchild.example").toLowerCase();
  const adminName = process.env.ADMIN_NAME || "School Administrator";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("Set ADMIN_PASSWORD before seeding.");
  const demo = process.env.SEED_DEMO === "1";
  const demoPassword = process.env.DEMO_PASSWORD || adminPassword;

  await wipe();

  if (!demo) {
    await prisma.$transaction(async (tx) => {
      await seedStructure(tx, "2025/2026", "Term 1");
      const staffId = "stf-admin";
      await tx.staff.create({ data: { id: staffId, name: adminName, email: adminEmail, status: "active", title: "School administrator" } });
      await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          role: "administrator",
          active: true,
          staffId,
          passwordHash: await argon2.hash(adminPassword),
        },
      });
    });
    console.log(`Seeded school structure and administrator ${adminEmail}`);
    return;
  }

  const state = createInitialState();
  const adminHash = await argon2.hash(adminPassword);
  const demoHash = await argon2.hash(demoPassword);

  await prisma.$transaction(async (tx) => {
    await seedStructure(tx, state.school.academicYear, state.school.currentTerm);
    for (const label of state.school.years) {
      if (label === state.school.academicYear) continue;
      const id = yearId(label);
      const range = yearRange(label);
      await tx.academicYear.create({ data: { id, label, startsOn: range.startsOn, endsOn: range.endsOn } });
      for (const [index, term] of TERMS.entries()) {
        const span = termRange(label, term);
        await tx.term.create({
          data: { id: termId(label, term), yearId: id, label: term, position: index + 1, startsOn: span.startsOn, endsOn: span.endsOn },
        });
      }
    }

    for (const room of state.classes) {
      await tx.classRoom.create({ data: { id: room.id, name: room.name, level: room.level, teacherId: room.teacherId } });
    }
    for (const subject of state.subjects) {
      await tx.subject.create({ data: { id: subject.id, name: subject.name, code: subject.code, levels: subject.levels } });
    }

    for (const member of state.staff) {
      await tx.staff.create({
        data: { id: member.id, name: member.name, email: member.email.toLowerCase(), status: member.status, title: member.role },
      });
      const isAdmin = member.email.toLowerCase() === adminEmail;
      await tx.user.create({
        data: {
          email: member.email.toLowerCase(),
          name: member.name,
          role: member.role,
          active: member.status === "active",
          staffId: member.id,
          passwordHash: isAdmin ? adminHash : demoHash,
        },
      });
      const year = yearId(state.school.academicYear);
      for (const classId of member.classIds) {
        for (const subjectId of member.subjectIds) {
          await tx.teacherAssignment.create({ data: { staffId: member.id, yearId: year, classId, subjectId } });
        }
      }
    }

    if (!state.staff.some((member) => member.email.toLowerCase() === adminEmail)) {
      const staffId = "stf-admin";
      await tx.staff.create({ data: { id: staffId, name: adminName, email: adminEmail, status: "active" } });
      await tx.user.create({
        data: { email: adminEmail, name: adminName, role: "administrator", active: true, staffId, passwordHash: adminHash },
      });
    }

    for (const student of state.students) {
      await tx.student.create({
        data: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          otherNames: student.otherNames,
          sex: student.sex,
          dateOfBirth: dateOnly(student.dateOfBirth),
          status: student.status === "withdrawn" ? "withdrawn" : student.status === "graduated" ? "graduated" : "active",
          enrolledOn: student.enrolledOn ? dateOnly(student.enrolledOn) : null,
          residentialAddress: student.residentialAddress,
        },
      });
      await tx.classEnrollment.create({
        data: { studentId: student.id, classId: student.classId, yearId: yearId(state.year), active: true },
      });
    }

    for (const guardian of state.guardians) {
      await tx.guardian.create({
        data: {
          id: guardian.id,
          fullName: guardian.fullName,
          phone: guardian.phone,
          email: guardian.email,
          occupation: guardian.occupation,
        },
      });
      await tx.studentGuardian.create({
        data: {
          studentId: guardian.studentId,
          guardianId: guardian.id,
          relationship: guardian.relationship,
          primary: guardian.primary,
        },
      });
    }

    const groups = new Map<string, typeof state.charges>();
    for (const charge of state.charges) {
      const key = `${charge.studentId}|${charge.year}|${charge.term}`;
      groups.set(key, [...(groups.get(key) ?? []), charge]);
    }
    let invoiceSequence = 0;
    const chargeInvoice = new Map<string, string>();
    for (const [key, charges] of groups) {
      invoiceSequence += 1;
      const [studentId, year, term] = key.split("|");
      const invoiceId = `inv-${invoiceSequence}`;
      await tx.invoice.create({
        data: {
          id: invoiceId,
          number: `INV-${String(invoiceSequence).padStart(5, "0")}`,
          kind: "school_fee",
          status: "issued",
          studentId,
          yearId: yearId(year),
          termLabel: term,
          issuedOn: dateOnly(charges[0].issuedOn),
          items: { create: charges.map((charge) => ({ id: charge.id, label: charge.label, amount: charge.amount })) },
        },
      });
      for (const charge of charges) chargeInvoice.set(charge.id, invoiceId);
    }
    await tx.counter.create({ data: { id: "invoice", value: invoiceSequence } });

    const method = (value: string) => {
      if (value === "Mobile Money") return "mobile_money" as const;
      if (value === "Bank Transfer") return "bank_transfer" as const;
      if (value === "Other") return "other" as const;
      return "cash" as const;
    };
    for (const payment of state.payments) {
      const byInvoice = new Map<string, number>();
      for (const allocation of payment.allocations) {
        const invoiceId = chargeInvoice.get(allocation.chargeId);
        if (!invoiceId) continue;
        byInvoice.set(invoiceId, (byInvoice.get(invoiceId) ?? 0) + allocation.amount);
      }
      await tx.payment.create({
        data: {
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          studentId: payment.studentId,
          paidOn: dateOnly(payment.date),
          method: method(payment.method),
          reference: payment.reference,
          amount: payment.amount,
          recordedById: payment.recordedBy,
          allocations: { create: [...byInvoice.entries()].map(([invoiceId, amount]) => ({ invoiceId, amount })) },
        },
      });
    }
    await tx.counter.create({ data: { id: "receipt", value: state.payments.length } });

    for (const adjustment of state.adjustments) {
      await tx.adjustment.create({
        data: {
          id: adjustment.id,
          studentId: adjustment.studentId,
          yearLabel: adjustment.year,
          termLabel: adjustment.term,
          label: adjustment.label,
          amount: adjustment.amount,
          reason: "Development fixture",
          createdById: "seed",
        },
      });
    }

    for (const invoice of await tx.invoice.findMany({ include: { items: true, allocations: true, adjustments: true } })) {
      const charges = invoice.items.reduce((sum, item) => sum + item.amount, 0);
      const paid = invoice.allocations.reduce((sum, item) => sum + item.amount, 0);
      const adjusted = invoice.adjustments.reduce((sum, item) => sum + item.amount, 0);
      const due = charges + adjusted - paid;
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: due <= 0 ? "paid" : paid > 0 ? "partial" : "issued" } });
    }

    const levels = ["KG", "Primary", "JHS"] as const;
    const catalogues = [
      { name: "Tuition", kg: 85000, primary: 85000, jhs: 110000 },
      { name: "Feeding", kg: 42000, primary: 42000, jhs: 48000 },
      { name: "PTA levy", kg: 8000, primary: 8000, jhs: 10000 },
    ];
    for (const catalogue of catalogues) {
      for (const level of levels) {
        const amount = level === "JHS" ? catalogue.jhs : level === "KG" ? catalogue.kg : catalogue.primary;
        const fee = await tx.feeItem.create({
          data: { name: catalogue.name, amount, kind: "school_fee", active: true, appliesTo: catalogue.name === "PTA levy" ? "new" : "all" },
        });
        const rooms = state.classes.filter((room) => room.level === level);
        for (const room of rooms) await tx.feeItemClass.create({ data: { feeItemId: fee.id, classId: room.id } });
      }
    }
    await tx.feeItem.create({ data: { name: "Admission fee", amount: 50000, kind: "admission", active: true, appliesTo: "new" } });

    for (const config of state.configs) {
      await tx.assessmentConfig.create({
        data: {
          id: config.id,
          yearId: yearId(config.year),
          termLabel: config.term,
          classId: config.classId,
          subjectId: config.subjectId,
          components: config.components,
          status: config.status,
        },
      });
    }
    for (const sheet of state.sheets) {
      await tx.markSheet.create({
        data: {
          id: sheet.id,
          configId: sheet.configId,
          status: sheet.status,
          returnReason: sheet.returnReason,
          rows: { create: sheet.rows.map((row) => ({ studentId: row.studentId, scores: row.scores, remark: row.remark })) },
        },
      });
    }
  }, { timeout: 120000 });

  console.log(`Seeded development school data. Administrator ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
