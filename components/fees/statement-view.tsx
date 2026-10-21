"use client";

import { DocumentHeader } from "@/components/print/document-header";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { canViewFinance } from "@/lib/prototype/permissions";
import { buildStatement, className, currentStaff, studentName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function StatementView({ studentId }: { studentId: string }) {
  const { state } = usePrototype();
  const staff = currentStaff(state);
  const student = state.students.find((item) => item.id === studentId);
  if (!staff || !canViewFinance(staff.role)) {
    return <Surface className="p-8 text-sm">Fee statements are visible to the accounts office.</Surface>;
  }
  if (!student) return <Surface className="p-8 text-sm">Student not found.</Surface>;
  const statement = buildStatement(state, student.id, state.year, state.term);
  // #region agent log
  // eslint-disable-next-line react-hooks/purity -- debug instrumentation
  fetch("http://127.0.0.1:7393/ingest/ba92319d-2d30-4e16-a20b-be71b8376aad",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"87cf4d"},body:JSON.stringify({sessionId:"87cf4d",runId:"post-fix",hypothesisId:"C",location:"statement-view.tsx:columns",message:"adjustment column",data:{studentId,adjustmentRows:statement.rows.filter((row)=>row.adjustment!==0).length,paymentColumnShowsAdjustment:false},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Fee statement"
          description="Preview ledger. Export is not connected in this phase."
          actions={
            <Button type="button" onClick={() => window.print()}>
              Print statement
            </Button>
          }
        />
      </div>
      <Surface className="print-sheet mx-auto w-full max-w-[210mm] p-4 sm:p-8">
        <DocumentHeader school={state.school} kicker="Student fee statement" />
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="block text-xs text-muted-foreground">Student</span>
            {studentName(student)}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Admission number</span>
            {student.admissionNumber}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Class</span>
            {className(state, student.classId)}
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Period</span>
            {state.term}, {state.year} ({formatDate(statement.start)} – {formatDate(statement.end)})
          </p>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <Stat label="Opening" value={formatMoney(statement.opening)} />
          <Stat label="Charges" value={formatMoney(statement.charges)} />
          <Stat label="Payments" value={formatMoney(statement.payments)} />
          <Stat label="Adjustments" value={formatMoney(statement.adjustments)} />
          <Stat label="Closing" value={formatMoney(statement.closing)} />
        </dl>
        <div className="mt-6 max-w-full overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Charge</th>
              <th className="py-2 text-right font-medium">Payment</th>
              <th className="py-2 text-right font-medium">Adjustment</th>
              <th className="py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2">{formatDate(statement.start)}</td>
              <td className="py-2">Opening balance</td>
              <td />
              <td />
              <td />
              <td className="py-2 text-right tabular-nums">{formatMoney(statement.opening)}</td>
            </tr>
            {statement.rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2">{formatDate(row.date)}</td>
                <td className="py-2">{row.label}</td>
                <td className="py-2 text-right tabular-nums">{row.charge ? formatMoney(row.charge) : "—"}</td>
                <td className="py-2 text-right tabular-nums">{row.payment ? formatMoney(row.payment) : "—"}</td>
                <td className="py-2 text-right tabular-nums">{row.adjustment ? formatMoney(row.adjustment) : "—"}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="mt-4 text-sm font-semibold">Closing balance {formatMoney(statement.closing)}</p>
        <p className="mt-6 text-center text-xs text-muted-foreground">Sample statement — not a school record.</p>
      </Surface>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-blue-pale px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-navy">{value}</p>
    </div>
  );
}
