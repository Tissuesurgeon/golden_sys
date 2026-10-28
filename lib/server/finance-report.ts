import { prisma } from "@/lib/db";
import { isoDate } from "@/lib/calendar";
import { invoiceBalance } from "@/lib/finance";

export type FinanceFilters = { from?: string; to?: string; yearId?: string; termId?: string; classId?: string; cashDate?: string };

const include = { items: true, adjustments: true, allocations: { include: { payment: true } }, student: { include: { enrollments: { where: { active: true }, include: { classRoom: true } }, guardians: { include: { guardian: true } } } }, term: true } as const;

export async function financeReport(filters: FinanceFilters) {
  const invoices = await prisma.invoice.findMany({
    where: {
      kind: "school_fee",
      ...(filters.yearId ? { yearId: filters.yearId } : {}),
      ...(filters.termId ? { termId: filters.termId } : {}),
      ...(filters.from || filters.to
        ? { issuedOn: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    },
    include,
  });
  const visible = invoices.filter((invoice) => {
    const room = invoice.student?.enrollments[0]?.classRoom;
    return !filters.classId || room?.id === filters.classId;
  });
  const balances = visible.map((invoice) => ({ invoice, ...invoiceBalance(invoice) }));
  const billed = balances.reduce((sum, row) => sum + row.charges, 0);
  const payments = await prisma.payment.findMany({
    where: {
      reversedAt: null,
      ...(filters.from || filters.to
        ? { paidOn: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    },
    include: { student: { include: { enrollments: { where: { active: true }, include: { classRoom: true } } } }, allocations: true },
  });
  const collectedPayments = payments.filter((payment) => !filters.classId || payment.student?.enrollments.some((item) => item.classId === filters.classId));
  const collected = collectedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const byMethod = new Map<string, number>();
  for (const payment of collectedPayments) byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount);
  const byItem = new Map<string, number>();
  for (const row of balances) for (const item of row.invoice.items) byItem.set(item.label, (byItem.get(item.label) ?? 0) + item.amount);
  const byClass = new Map<string, number>();
  for (const payment of collectedPayments) {
    const name = payment.student?.enrollments[0]?.classRoom.name ?? "Unassigned";
    byClass.set(name, (byClass.get(name) ?? 0) + payment.amount);
  }
  const byDay = new Map<string, number>();
  for (const payment of collectedPayments) {
    const day = isoDate(payment.paidOn);
    byDay.set(day, (byDay.get(day) ?? 0) + payment.amount);
  }
  const today = new Date();
  const ageing = { "0–30": 0, "31–60": 0, "61–90": 0, "90+": 0 };
  const debtorMap = new Map<string, { studentId: string; name: string; className: string; phone: string; amount: number; dueOn: string }>();
  for (const row of balances) {
    if (row.balance <= 0 || !row.invoice.student) continue;
    const due = row.invoice.dueOn;
    const days = due ? Math.floor((today.getTime() - due.getTime()) / 86_400_000) : 0;
    const bucket = days <= 30 ? "0–30" : days <= 60 ? "31–60" : days <= 90 ? "61–90" : "90+";
    ageing[bucket] += row.balance;
    const student = row.invoice.student;
    const dueOn = due ? isoDate(due) : "";
    const existing = debtorMap.get(student.id);
    if (existing) {
      existing.amount += row.balance;
      if (dueOn && (!existing.dueOn || dueOn < existing.dueOn)) existing.dueOn = dueOn;
    } else {
      const phone = student.guardians.find((item) => item.primary)?.guardian.phone || student.guardians[0]?.guardian.phone || "";
      debtorMap.set(student.id, {
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        className: student.enrollments[0]?.classRoom.name ?? "Unassigned",
        phone,
        amount: row.balance,
        dueOn,
      });
    }
  }
  const debtors = [...debtorMap.values()].sort((a, b) => b.amount - a.amount);
  const cashDate = filters.cashDate || isoDate(today);
  const cashRows = collectedPayments.filter((payment) => isoDate(payment.paidOn) === cashDate);
  const recorders = await prisma.user.findMany({
    where: { id: { in: [...new Set(cashRows.map((payment) => payment.recordedById))] } },
    select: { id: true, name: true },
  });
  const recorderName = new Map(recorders.map((user) => [user.id, user.name]));
  const cash = cashRows.map((payment) => ({
    receipt: payment.receiptNumber,
    method: payment.method,
    amount: payment.amount,
    recorder: recorderName.get(payment.recordedById) || "Office",
  }));
  return {
    billed,
    collected,
    outstanding,
    rate: billed === 0 ? 0 : Math.round((collected / billed) * 100),
    byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })),
    byItem: [...byItem.entries()].map(([item, amount]) => ({ item, amount })),
    byClass: [...byClass.entries()].map(([className, amount]) => ({ className, amount })),
    series: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })),
    ageing,
    debtors,
    cashDate,
    cash,
    cashTotal: cash.reduce((sum, row) => sum + row.amount, 0),
  };
}
