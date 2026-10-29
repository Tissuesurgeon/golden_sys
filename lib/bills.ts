import { invoiceBalance, type BalanceInvoice } from "@/lib/finance";
import { applicableFees, type FeeAppliesTo } from "@/lib/invoices";

export type BillLine = { label: string; amount: number; feeItemId: string | null };
export type TermOrder = { yearStartsOn: number; position: number };

export function isEarlierTerm(candidate: TermOrder, chosen: TermOrder) {
  if (candidate.yearStartsOn !== chosen.yearStartsOn) return candidate.yearStartsOn < chosen.yearStartsOn;
  return candidate.position < chosen.position;
}

export function currentFeeLines(fees: { id: string; name: string; amount: number; appliesTo: FeeAppliesTo }[], audience: "new" | "returning"): BillLine[] {
  return applicableFees(fees, audience)
    .filter((fee) => fee.amount > 0)
    .map((fee) => ({ label: fee.name, amount: fee.amount, feeItemId: fee.id }));
}

export function broughtForward(
  invoices: (BalanceInvoice & TermOrder)[],
  chosen: TermOrder,
) {
  return invoices
    .filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "reversed" && isEarlierTerm(invoice, chosen))
    .reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(invoice).balance), 0);
}

export function buildFeeBill(input: {
  fees: { id: string; name: string; amount: number; appliesTo: FeeAppliesTo }[];
  audience: "new" | "returning";
  prior: (BalanceInvoice & TermOrder)[];
  term: TermOrder;
  adjustments: number;
  paid: number;
}) {
  const lines = currentFeeLines(input.fees, input.audience);
  const feesTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const balanceBroughtForward = broughtForward(input.prior, input.term);
  const total = feesTotal + balanceBroughtForward;
  const due = total + input.adjustments - input.paid;
  return { lines, feesTotal, balanceBroughtForward, adjustments: input.adjustments, paid: input.paid, total, due };
}

export function paymentInstructions(school: { address: string; phone: string; email: string }) {
  return ["Pay at the school office.", school.address, school.phone, school.email].filter(Boolean).join(" ");
}

export function planInvoiceUpdate(stored: { amount: number }[], current: BillLine[], hasPayments: boolean) {
  const storedTotal = stored.reduce((sum, line) => sum + line.amount, 0);
  const currentTotal = current.reduce((sum, line) => sum + line.amount, 0);
  if (storedTotal === currentTotal) return { action: "unchanged" as const };
  if (!hasPayments) return { action: "replace" as const, lines: current };
  return {
    action: "difference" as const,
    line: { label: "Fee update", amount: currentTotal - storedTotal, feeItemId: null as string | null },
  };
}
