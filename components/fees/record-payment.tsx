"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { canRecordPayments, canViewFinance } from "@/lib/prototype/permissions";
import { chargeBalance, className, currentStaff, studentName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { PaymentMethod } from "@/lib/prototype/types";
import { formatMoney } from "@/lib/format";

const METHODS: PaymentMethod[] = ["Cash", "Mobile Money", "Bank Transfer", "Other"];

export function RecordPayment() {
  const params = useSearchParams();
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState(params.get("student") ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return state.students
      .filter((student) => `${studentName(student)} ${student.admissionNumber}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [query, state.students]);

  if (!staff || !canViewFinance(staff.role) || !canRecordPayments(staff.role)) {
    return (
      <Surface className="p-8">
        <h1 className="text-xl font-semibold text-navy">Payment recording is for the accounts office</h1>
      </Surface>
    );
  }

  const student = state.students.find((item) => item.id === studentId);
  const openCharges = state.charges.filter(
    (charge) => charge.studentId === studentId && charge.year === state.year && charge.term === state.term && chargeBalance(state, charge.id) > 0,
  );
  const selectedCharges = openCharges.filter((charge) => selected.includes(charge.id));
  const selectedBalance = selectedCharges.reduce((sum, charge) => sum + chargeBalance(state, charge.id), 0);
  const pesewas = Math.round(Number(amount) * 100);

  function allocate(total: number) {
    let left = total;
    const allocations = [];
    for (const charge of selectedCharges) {
      if (left <= 0) break;
      const due = chargeBalance(state, charge.id);
      const applied = Math.min(due, left);
      allocations.push({ chargeId: charge.id, amount: applied });
      left -= applied;
    }
    return allocations;
  }

  const allocation = Number.isFinite(pesewas) ? allocate(pesewas) : [];

  function next() {
    setError("");
    if (step === 1 && !student) {
      setError("Select a student before continuing.");
      return;
    }
    if (step === 2 && selectedCharges.length === 0) {
      setError("Select at least one outstanding charge.");
      return;
    }
    if (step === 3) {
      if (!Number.isFinite(pesewas) || pesewas <= 0) {
        setError("Enter an amount greater than zero.");
        return;
      }
      if (pesewas > selectedBalance) {
        setError("The amount is higher than the selected balance.");
        return;
      }
      if (!date) {
        setError("Enter the payment date.");
        return;
      }
      if (date > new Date().toISOString().slice(0, 10)) {
        setError("The payment date cannot be in the future.");
        return;
      }
      if (method !== "Cash" && reference.trim().length < 3) {
        setError("Enter the payment reference.");
        return;
      }
    }
    setStep((value) => value + 1);
  }

  async function confirm() {
    if (!student) return;
    const id = `pay-${student.id}-${state.payments.length + 1}`;
    const errorMessage = await dispatch({
      type: "record-payment",
      payment: {
        id,
        receiptNumber: "",
        studentId: student.id,
        date,
        method,
        reference: reference.trim(),
        amount: pesewas,
        allocations: allocation,
        recordedBy: staff?.id ?? "",
        sample: false,
      },
    });
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    setReceiptId(id);
    setStep(5);
  }

  return (
    <div>
      <PageHeader title="Record payment" description="Find the student, choose the charges, then review the allocation before confirming." />
      <ol className="mb-4 flex flex-wrap gap-2 text-xs">
        {["Student", "Charges", "Amount", "Review", "Receipt"].map((label, index) => (
          <li key={label}>
            <StatusBadge tone={step === index + 1 ? "info" : step > index + 1 ? "success" : "neutral"}>
              {index + 1}. {label}
            </StatusBadge>
          </li>
        ))}
      </ol>

      {student && step < 5 ? (
        <Surface className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-navy">{studentName(student)}</p>
            <p className="text-xs text-muted-foreground">
              {student.admissionNumber} · {className(state, student.classId)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Selected balance</p>
            <p className="text-lg font-semibold text-danger">{formatMoney(selectedBalance)}</p>
          </div>
        </Surface>
      ) : null}

      <Surface className="p-5">
        {step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-navy">Find the student</h2>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or admission number" aria-label="Find student" />
            <ul className="divide-y divide-border rounded-xl border border-border">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-3 text-left hover:bg-blue-pale"
                    onClick={() => {
                      setStudentId(item.id);
                      setSelected([]);
                      setError("");
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium">{studentName(item)}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.admissionNumber} · {className(state, item.classId)}
                      </span>
                    </span>
                    {studentId === item.id ? <StatusBadge tone="info">Selected</StatusBadge> : null}
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && matches.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No student matches.</li> : null}
            </ul>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-navy">Outstanding charges</h2>
            {openCharges.length === 0 ? (
              <p className="text-sm text-muted-foreground">This student has no outstanding charges for {state.term}.</p>
            ) : (
              openCharges.map((charge) => {
                const due = chargeBalance(state, charge.id);
                const checked = selected.includes(charge.id);
                return (
                  <label key={charge.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelected((current) => (value ? [...current, charge.id] : current.filter((id) => id !== charge.id)));
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium">{charge.label}</span>
                        <span className="text-xs text-muted-foreground">{charge.year}</span>
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(due)}</span>
                  </label>
                );
              })
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-navy sm:col-span-2">Payment details</h2>
            <label className="space-y-1.5">
              <span className="text-[13px] font-medium">Amount (GHS)</span>
              <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[13px] font-medium">Payment date</span>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-[13px] font-medium">Method</span>
              <select className={selectClassName()} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                {METHODS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[13px] font-medium">Reference</span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={method === "Cash" ? "Optional for cash" : "Transaction reference"} />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-navy">Review allocation</h2>
            <p className="text-sm text-muted-foreground">Recorded by the school. Not verified by a payment gateway.</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd className="text-lg font-semibold">{formatMoney(pesewas)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remaining after payment</dt>
                <dd className="text-lg font-semibold text-danger">{formatMoney(selectedBalance - pesewas)}</dd>
              </div>
            </dl>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {allocation.map((item) => {
                const charge = state.charges.find((entry) => entry.id === item.chargeId);
                return (
                  <li key={item.chargeId} className="flex justify-between px-3 py-3 text-sm">
                    <span>{charge?.label}</span>
                    <span className="tabular-nums">{formatMoney(item.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {step === 5 && receiptId ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-navy">Receipt is ready</h2>
            <p className="text-sm text-muted-foreground">The payment is stored on the student account. Open the receipt to print it.</p>
            <LinkButton href={`/fees/receipts/${receiptId}`}>View receipt</LinkButton>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        {step < 5 ? (
          <div className="mt-6 flex justify-between">
            <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={confirm}>
                Confirm payment
              </Button>
            )}
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
