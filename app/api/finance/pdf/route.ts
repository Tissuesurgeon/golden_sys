import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { pdfResponse, renderPdf } from "@/lib/pdf";
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
  const lines = [
    `Billed ${formatMoney(report.billed)}`,
    `Collected ${formatMoney(report.collected)}`,
    `Outstanding ${formatMoney(report.outstanding)}`,
    `Collection rate ${report.rate}%`,
    "",
    "By method",
    ...report.byMethod.map((row) => `${row.method} ${formatMoney(row.amount)}`),
    "",
    "By class",
    ...report.byClass.map((row) => `${row.className} ${formatMoney(row.amount)}`),
    "",
    "Ageing",
    ...Object.entries(report.ageing).map(([label, amount]) => `${label} ${formatMoney(amount)}`),
    "",
    `Daily cash ${report.cashDate} ${formatMoney(report.cashTotal)}`,
    ...report.cash.map((row) => `${row.receipt} ${row.method} ${formatMoney(row.amount)}`),
  ];
  return pdfResponse("Finance report", await renderPdf("Finance report", lines));
}
