import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { financeReport, type FinanceFilters } from "@/lib/server/finance-report";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "finance.read")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const url = new URL(request.url);
  const filters: FinanceFilters = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    yearId: url.searchParams.get("yearId") || undefined,
    termId: url.searchParams.get("termId") || undefined,
    classId: url.searchParams.get("classId") || undefined,
    cashDate: url.searchParams.get("cashDate") || undefined,
  };
  const report = await financeReport(filters);
  const body = [
    toCsv(["Summary", "Pesewas"], [["Billed", report.billed], ["Collected", report.collected], ["Outstanding", report.outstanding], ["Collection rate", report.rate]]),
    toCsv(["Method", "Pesewas"], report.byMethod.map((row) => [row.method, row.amount])),
    toCsv(["Fee item", "Pesewas"], report.byItem.map((row) => [row.item, row.amount])),
    toCsv(["Class", "Pesewas"], report.byClass.map((row) => [row.className, row.amount])),
    toCsv(["Date", "Pesewas"], report.series.map((row) => [row.date, row.amount])),
    toCsv(["Ageing", "Pesewas"], Object.entries(report.ageing)),
    toCsv(["Student", "Class", "Phone", "Due", "Pesewas"], report.debtors.map((row) => [row.name, row.className, row.phone, row.dueOn, row.amount])),
    toCsv(["Receipt", "Method", "Recorded by", "Pesewas"], report.cash.map((row) => [row.receipt, row.method, row.recorder, row.amount])),
  ].join("\n\n");
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=finance.csv" },
  });
}
