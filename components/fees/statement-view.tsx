"use client";

import { DocumentHeader } from "@/components/print/document-header";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { adjustmentFormAction } from "@/lib/server/forms";
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

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Fee statement"
          description="Charges, payments, adjustments, and the closing balance for this term."
          actions={
            <div className="flex gap-2">
              <Button type="button" onClick={() => window.print()}>
                Print statement
              </Button>
              <a className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium" href={`/api/pdf/statement/${student.id}`}>
                PDF
              </a>
            </div>
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
        <p className="mt-6 text-center text-xs text-muted-foreground">Recorded school statement. Payments are not gateway-verified.</p>
      </Surface>
      <form action={adjustmentFormAction} className="no-print mt-4 grid gap-2 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
        <input type="hidden" name="studentId" value={student.id} />
        <input type="hidden" name="year" value={state.year} />
        <input type="hidden" name="term" value={state.term} />
        <input name="label" placeholder="Adjustment label" className="h-11 rounded-lg border border-input px-3 text-sm" />
        <input name="amount" placeholder="Amount in GHS, negative to waive" className="h-11 rounded-lg border border-input px-3 text-sm" />
        <input name="reason" required placeholder="Reason" className="h-11 rounded-lg border border-input px-3 text-sm sm:col-span-2" />
        <button className="h-11 rounded-lg border border-border text-sm font-medium sm:col-span-2">Record adjustment</button>
      </form>
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
