export type DraftLine = { label: string; amount: number; feeItemId: string | null };
export type FeeAppliesTo = "new" | "returning" | "all";
export type StudentCohort = "new" | "returning" | "not_enrolled";
export type TermSpan = { id: string; startsOn: Date; endsOn: Date };

/**
 * A student is new for the first term they are enrolled in, and returning after that.
 *
 * The first enrolled term is the earliest term whose end date is on or after the
 * student's enrolment date. They joined during that term, or before it started and
 * this is the first term still open to them. A term that ended before the enrolment
 * date is not their term. A missing enrolment date is treated as returning so an
 * existing record is not charged new-student fees such as admission, uniform, or PTA.
 */
export function studentAudience(enrolledOn: Date | null, term: TermSpan, terms: TermSpan[]): StudentCohort {
  if (!enrolledOn) return "returning";
  const enrolled = enrolledOn.getTime();
  if (term.endsOn.getTime() < enrolled) return "not_enrolled";
  const first = [...terms]
    .filter((item) => item.endsOn.getTime() >= enrolled)
    .sort((left, right) => left.startsOn.getTime() - right.startsOn.getTime())[0];
  if (!first) return "not_enrolled";
  return first.id === term.id ? "new" : "returning";
}

export function applicableFees<T extends { appliesTo: FeeAppliesTo }>(fees: T[], audience: "new" | "returning") {
  return fees.filter((fee) => fee.appliesTo === "all" || fee.appliesTo === audience);
}

export function termInvoiceLines(
  fees: { id: string; name: string; amount: number }[],
  arrears: number,
  extras: DraftLine[] = [],
): DraftLine[] {
  const lines: DraftLine[] = fees.filter((fee) => fee.amount > 0).map((fee) => ({ label: fee.name, amount: fee.amount, feeItemId: fee.id }));
  lines.push(...extras);
  if (arrears > 0) lines.push({ label: "Arrears brought forward", amount: arrears, feeItemId: null });
  return lines;
}

export function parseExtraLines(rows: { label: string; amountPesewas: number; reason: string }[]) {
  const used = rows.filter((row) => row.label.trim() || row.amountPesewas || row.reason.trim());
  for (const row of used) {
    if (row.label.trim().length < 2) return { error: "Each extra line needs a description." };
    if (!Number.isInteger(row.amountPesewas) || row.amountPesewas <= 0) return { error: "Each extra line needs an amount." };
    if (row.reason.trim().length < 3) return { error: "Each extra line needs a reason." };
  }
  return {
    lines: used.map((row) => ({ label: row.label.trim(), amount: row.amountPesewas, feeItemId: null as string | null })),
    notes: used.map((row) => `${row.label.trim()}: ${row.reason.trim()}`).join("\n"),
  };
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
