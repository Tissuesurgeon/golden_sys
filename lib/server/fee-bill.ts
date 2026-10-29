import { prisma } from "@/lib/db";
import { buildFeeBill, type TermOrder } from "@/lib/bills";
import { invoiceBalance } from "@/lib/finance";
import { addDays, studentAudience } from "@/lib/invoices";
import { feesForClass } from "@/lib/server/invoice-preview";

const active = { notIn: ["cancelled", "reversed"] as ("cancelled" | "reversed")[] };

export async function composeStudentBill(studentId: string, termId: string) {
  const term = await prisma.term.findUnique({ where: { id: termId }, include: { year: true } });
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  if (!term || !settings) return { error: "Choose a term." };
  const [student, terms, invoices] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { enrollments: { where: { yearId: term.yearId, active: true }, include: { classRoom: true } } },
    }),
    prisma.term.findMany({ select: { id: true, startsOn: true, endsOn: true } }),
    prisma.invoice.findMany({
      where: { studentId, kind: "school_fee", status: active },
      include: {
        items: true,
        adjustments: true,
        allocations: { include: { payment: true } },
        term: { include: { year: true } },
      },
    }),
  ]);
  if (!student) return { error: "Student not found." };
  const enrollment = student.enrollments[0];
  if (!enrollment) return { error: "This student is not enrolled for that year." };
  const audience = studentAudience(student.enrolledOn, term, terms);
  if (audience === "not_enrolled") return { error: "This student was not enrolled during that term." };
  const fees = await feesForClass(prisma, enrollment.classId, term.id);
  const chosen: TermOrder = { yearStartsOn: term.year.startsOn.getTime(), position: term.position };
  const prior = invoices.flatMap((invoice) => {
    if (!invoice.term) return [];
    return [{
      status: invoice.status,
      items: invoice.items,
      adjustments: invoice.adjustments,
      allocations: invoice.allocations,
      yearStartsOn: invoice.term.year.startsOn.getTime(),
      position: invoice.term.position,
    }];
  });
  const current = invoices.find((invoice) => invoice.termId === term.id);
  const balance = current ? invoiceBalance(current) : { adjustments: 0, paid: 0 };
  const bill = buildFeeBill({
    fees,
    audience,
    prior,
    term: chosen,
    adjustments: balance.adjustments,
    paid: balance.paid,
  });
  return {
    student,
    className: enrollment.classRoom.name,
    classId: enrollment.classId,
    audience,
    term,
    settings,
    bill,
    dueOn: addDays(term.startsOn, settings.invoiceDueDays),
    invoiceNumber: current?.number ?? "",
  };
}

export async function composeClassBills(classId: string, termId: string) {
  const term = await prisma.term.findUnique({ where: { id: termId } });
  const room = await prisma.classRoom.findUnique({ where: { id: classId } });
  if (!term || !room) return { error: "Choose a class and a term." };
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, yearId: term.yearId, active: true, student: { status: "active" } },
    include: { student: true },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
  const bills = [];
  for (const enrollment of enrollments) {
    const bill = await composeStudentBill(enrollment.studentId, termId);
    if ("error" in bill) continue;
    bills.push(bill);
  }
  if (bills.length === 0) return { error: "No bills for this class." };
  return { className: room.name, bills };
}
