import type {
  GradeBand,
  MarkSheet,
  PrototypeState,
  Student,
} from "@/lib/prototype/types";

export function studentName(student: Pick<Student, "firstName" | "otherNames" | "lastName">) {
  return [student.firstName, student.otherNames, student.lastName].filter(Boolean).join(" ");
}

export function className(state: PrototypeState, classId: string) {
  return state.classes.find((item) => item.id === classId)?.name ?? "Unassigned";
}

export function subjectName(state: PrototypeState, subjectId: string) {
  return state.subjects.find((item) => item.id === subjectId)?.name ?? "Subject";
}

export function staffById(state: PrototypeState, staffId: string | null) {
  if (!staffId) return null;
  return state.staff.find((item) => item.id === staffId) ?? null;
}

export function currentStaff(state: PrototypeState) {
  return staffById(state, state.sessionStaffId);
}

export function paidToward(state: PrototypeState, chargeId: string) {
  return state.payments.reduce(
    (sum, payment) =>
      sum + payment.allocations.filter((item) => item.chargeId === chargeId).reduce((inner, item) => inner + item.amount, 0),
    0,
  );
}

export function chargeBalance(state: PrototypeState, chargeId: string) {
  const charge = state.charges.find((item) => item.id === chargeId);
  if (!charge) return 0;
  return Math.max(0, charge.amount - paidToward(state, chargeId));
}

export function periodBounds(year: string, term: string) {
  const [startYear = year.slice(0, 4), endYear = year.slice(5)] = year.split("/");
  let bounds: { start: string; end: string };
  // Sample Term 1 bills are dated September 2026, so later terms of this year follow that window.
  if (year === "2025/2026" && term === "Term 1") bounds = { start: "2026-09-01", end: "2026-12-18" };
  else if (year === "2025/2026" && term === "Term 2") bounds = { start: "2027-01-08", end: "2027-04-10" };
  else if (year === "2025/2026" && term === "Term 3") bounds = { start: "2027-04-20", end: "2027-07-31" };
  else if (term === "Term 2") bounds = { start: `${endYear}-01-08`, end: `${endYear}-04-10` };
  else if (term === "Term 3") bounds = { start: `${endYear}-04-20`, end: `${endYear}-07-31` };
  else bounds = { start: `${startYear}-09-01`, end: `${startYear}-12-18` };
  // #region agent log
  fetch("http://127.0.0.1:7393/ingest/ba92319d-2d30-4e16-a20b-be71b8376aad",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"87cf4d"},body:JSON.stringify({sessionId:"87cf4d",hypothesisId:"A",location:"selectors.ts:periodBounds",message:"period bounds",data:{year,term,start:bounds.start,end:bounds.end},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return bounds;
}

export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  charge: number;
  payment: number;
  adjustment: number;
  balance: number;
};

export function buildStatement(state: PrototypeState, studentId: string, year: string, term: string) {
  const { start, end } = periodBounds(year, term);
  const inPeriod = (date: string) => date >= start && date <= end;
  const before = (date: string) => date < start;

  const events: Array<Omit<LedgerRow, "balance">> = [];

  for (const charge of state.charges.filter((item) => item.studentId === studentId)) {
    events.push({
      id: charge.id,
      date: charge.issuedOn,
      label: charge.label,
      charge: charge.amount,
      payment: 0,
      adjustment: 0,
    });
  }
  for (const adjustment of state.adjustments.filter((item) => item.studentId === studentId)) {
    events.push({
      id: adjustment.id,
      date: adjustment.date,
      label: adjustment.label,
      charge: 0,
      payment: 0,
      adjustment: adjustment.amount,
    });
  }
  for (const payment of state.payments.filter((item) => item.studentId === studentId)) {
    events.push({
      id: payment.id,
      date: payment.date,
      label: `Payment ${payment.receiptNumber}`,
      charge: 0,
      payment: payment.amount,
      adjustment: 0,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  let running = 0;
  const opening = events
    .filter((event) => before(event.date))
    .reduce((sum, event) => sum + event.charge + event.adjustment - event.payment, 0);
  running = opening;

  const rows: LedgerRow[] = events
    .filter((event) => inPeriod(event.date))
    .map((event) => {
      running += event.charge + event.adjustment - event.payment;
      return { ...event, balance: running };
    });

  const periodCharges = rows.reduce((sum, row) => sum + row.charge, 0);
  const periodPayments = rows.reduce((sum, row) => sum + row.payment, 0);
  const periodAdjustments = rows.reduce((sum, row) => sum + row.adjustment, 0);

  const result = {
    opening,
    charges: periodCharges,
    payments: periodPayments,
    adjustments: periodAdjustments,
    closing: opening + periodCharges + periodAdjustments - periodPayments,
    rows,
    start,
    end,
  };
  // #region agent log
  fetch("http://127.0.0.1:7393/ingest/ba92319d-2d30-4e16-a20b-be71b8376aad",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"87cf4d"},body:JSON.stringify({sessionId:"87cf4d",hypothesisId:"C",location:"selectors.ts:buildStatement",message:"statement totals",data:{studentId,year,term,opening:result.opening,closing:result.closing,adjustments:result.adjustments,waiverInPaymentColumn:result.rows.some((row)=>row.adjustment!==0&&row.payment===0)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return result;
}

export function studentOutstanding(state: PrototypeState, studentId: string, year?: string, term?: string) {
  const charges = state.charges.filter(
    (item) => item.studentId === studentId && (!year || item.year === year) && (!term || item.term === term),
  );
  const chargeTotal = charges.reduce((sum, item) => sum + item.amount, 0);
  const paid = charges.reduce((sum, item) => sum + paidToward(state, item.id), 0);
  const adjustments = state.adjustments
    .filter((item) => item.studentId === studentId && (!year || item.year === year) && (!term || item.term === term))
    .reduce((sum, item) => sum + item.amount, 0);
  const outstanding = year && term ? buildStatement(state, studentId, year, term).closing : chargeTotal + adjustments - paid;
  // #region agent log
  fetch("http://127.0.0.1:7393/ingest/ba92319d-2d30-4e16-a20b-be71b8376aad",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"87cf4d"},body:JSON.stringify({sessionId:"87cf4d",hypothesisId:"B",location:"selectors.ts:studentOutstanding",message:"term outstanding ignores opening",data:{studentId,year:year??null,term:term??null,outstanding},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return outstanding;
}

export function financeSummary(state: PrototypeState, year: string, term: string) {
  const charges = state.charges.filter((item) => item.year === year && item.term === term);
  const charged = charges.reduce((sum, item) => sum + item.amount, 0);
  const adjustments = state.adjustments
    .filter((item) => item.year === year && item.term === term)
    .reduce((sum, item) => sum + item.amount, 0);
  const collected = charges.reduce((sum, item) => sum + paidToward(state, item.id), 0);
  const outstanding = state.students.reduce((sum, student) => sum + studentOutstanding(state, student.id, year, term), 0);
  const rate = charged === 0 ? 0 : Math.round((collected / charged) * 100);
  return { charged, collected, outstanding, adjustments, rate };
}

export function gradeFor(total: number, bands: GradeBand[]) {
  const match = [...bands].sort((a, b) => b.min - a.min).find((band) => total >= band.min);
  return match ?? bands[bands.length - 1];
}

export function summariseRow(
  components: Array<{ id: string; name: string; max: number }>,
  scores: Record<string, number | null>,
  bands: GradeBand[],
) {
  const missing = components.filter((component) => scores[component.id] == null);
  if (missing.length > 0) {
    return { total: null as number | null, grade: null as string | null, missing: missing.map((item) => item.name) };
  }
  const total = components.reduce((sum, component) => sum + (scores[component.id] ?? 0), 0);
  return { total, grade: gradeFor(total, bands).grade, missing: [] as string[] };
}

export function configForSheet(state: PrototypeState, sheet: MarkSheet) {
  return state.configs.find((item) => item.id === sheet.configId) ?? null;
}

export function studentsInClass(state: PrototypeState, classId: string, includeWithdrawn = false) {
  return state.students.filter(
    (student) => student.classId === classId && (includeWithdrawn || student.status === "enrolled"),
  );
}

export function teacherCanAccessClass(state: PrototypeState, classId: string, subjectId?: string) {
  const staff = currentStaff(state);
  if (!staff || staff.role !== "teacher") return true;
  if (!staff.classIds.includes(classId)) return false;
  if (subjectId && !staff.subjectIds.includes(subjectId)) return false;
  return true;
}

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
};

export function recentActivity(state: PrototypeState): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const payment of state.payments) {
    const student = state.students.find((item) => item.id === payment.studentId);
    if (!student) continue;
    items.push({
      id: payment.id,
      title: `Payment ${payment.receiptNumber}`,
      detail: `${studentName(student)} · ${payment.method}`,
      date: payment.date,
    });
  }
  for (const sheet of state.sheets) {
    const config = configForSheet(state, sheet);
    if (!config) continue;
    items.push({
      id: sheet.id,
      title: `${subjectName(state, config.subjectId)} marks ${sheet.status}`,
      detail: className(state, config.classId),
      date: "2026-10-18",
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}
