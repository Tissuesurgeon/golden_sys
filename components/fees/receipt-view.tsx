"use client";

import { DocumentHeader } from "@/components/print/document-header";
import { LinkButton, Surface } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { reversePaymentAction } from "@/lib/server/forms";
import { formatDate, formatMoney } from "@/lib/format";
import { canViewFinance } from "@/lib/prototype/permissions";
import { chargeBalance, className, currentStaff, studentName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function ReceiptView({ paymentId }: { paymentId: string }) {
  const { state } = usePrototype();
  const staff = currentStaff(state);
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!staff || !canViewFinance(staff.role)) {
    return <Surface className="p-8 text-sm">Receipts are visible to the accounts office.</Surface>;
  }
  if (!payment) {
    return <Surface className="p-8 text-sm">That receipt was not found.</Surface>;
  }
  const student = state.students.find((item) => item.id === payment.studentId);
  const remaining = payment.allocations.reduce((sum, allocation) => sum + chargeBalance(state, allocation.chargeId), 0);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => window.print()}>
          Print receipt
        </Button>
        {student ? (
          <LinkButton variant="outline" href={`/fees/statements/${student.id}`}>
            View statement
          </LinkButton>
        ) : null}
        <a className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium" href={`/api/pdf/receipt/${payment.id}`}>
          PDF
        </a>
      </div>
      <Surface className="print-sheet mx-auto w-full max-w-[210mm] p-4 sm:p-8">
        <DocumentHeader school={state.school} kicker="Official receipt" />
        <p className="mt-4 text-sm text-muted-foreground">Recorded by the school. Not verified by a payment gateway.</p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Receipt number" value={payment.receiptNumber} />
          <Item label="Date" value={formatDate(payment.date)} />
          <Item label="Student" value={student ? studentName(student) : "—"} />
          <Item label="Admission number" value={student?.admissionNumber ?? "—"} />
          <Item label="Class" value={student ? className(state, student.classId) : "—"} />
          <Item label="Method" value={payment.method} />
          <Item label="Reference" value={payment.reference || "—"} />
          <Item label="Amount received" value={formatMoney(payment.amount)} />
        </dl>
        <h2 className="mt-6 text-base font-semibold text-navy">Allocation</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Charge</th>
              <th className="py-2 text-right font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations.map((allocation) => {
              const charge = state.charges.find((item) => item.id === allocation.chargeId);
              return (
                <tr key={allocation.chargeId} className="border-b border-border">
                  <td className="py-2">{charge?.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(allocation.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-sm">
          Remaining balance on these charges: <span className="font-semibold">{formatMoney(remaining)}</span>
        </p>
        <p className="mt-8 text-center text-xs text-muted-foreground">{state.school.motto}</p>
      </Surface>
      <form action={reversePaymentAction} className="no-print mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="paymentId" value={payment.id} />
        <input name="reason" required placeholder="Reason for reversal" className="h-11 min-w-0 flex-1 rounded-lg border border-input px-3 text-sm" />
        <button className="h-11 rounded-lg border border-danger px-4 text-sm text-danger">Reverse payment</button>
      </form>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
