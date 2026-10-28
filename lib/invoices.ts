export type DraftLine = { label: string; amount: number; feeItemId: string | null };

export function termInvoiceLines(fees: { id: string; name: string; amount: number }[], arrears: number): DraftLine[] {
  const lines: DraftLine[] = fees.filter((fee) => fee.amount > 0).map((fee) => ({ label: fee.name, amount: fee.amount, feeItemId: fee.id }));
  if (arrears > 0) lines.push({ label: "Arrears brought forward", amount: arrears, feeItemId: null });
  return lines;
}

export function splitInvoiceRun(studentIds: string[], existing: Set<string>) {
  return {
    create: studentIds.filter((id) => !existing.has(id)),
    skipped: studentIds.filter((id) => existing.has(id)),
  };
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
