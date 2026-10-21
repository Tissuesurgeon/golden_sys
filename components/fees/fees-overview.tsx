"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName } from "@/components/common/ui-bits";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { canRecordPayments, canViewFinance } from "@/lib/prototype/permissions";
import {
  className,
  currentStaff,
  financeSummary,
  studentName,
  studentOutstanding,
} from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function FeesOverview() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const [classId, setClassId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const owing = useMemo(
    () =>
      state.students
        .filter((student) => classId === "all" || student.classId === classId)
        .map((student) => ({ student, balance: studentOutstanding(state, student.id, state.year, state.term) }))
        .filter((item) => item.balance > 0)
        .sort((a, b) => b.balance - a.balance),
    [state, classId],
  );

  if (!staff || !canViewFinance(staff.role)) {
    return (
      <Surface className="p-8">
        <h1 className="text-xl font-semibold text-navy">Fees are limited to the accounts office</h1>
        <p className="mt-2 text-sm text-muted-foreground">Teachers do not see balances or payment records.</p>
      </Surface>
    );
  }

  const summary = financeSummary(state, state.year, state.term);
  const payments = state.payments.filter((payment) => {
    if (from && payment.date < from) return false;
    if (to && payment.date > to) return false;
    const student = state.students.find((item) => item.id === payment.studentId);
    if (classId !== "all" && student?.classId !== classId) return false;
    return true;
  });

  const chart = payments.reduce<Record<string, number>>((groups, payment) => {
    groups[payment.date] = (groups[payment.date] ?? 0) + payment.amount;
    return groups;
  }, {});
  const chartData = Object.entries(chart)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: formatDate(date), amount: amount / 100 }));

  return (
    <div>
      <PageHeader
        title="Fees"
        description={`${state.term}, ${state.year}. Figures update inside this preview when a sample payment is recorded.`}
        actions={
          canRecordPayments(staff.role) ? <LinkButton href="/fees/record">Record payment</LinkButton> : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className="font-medium text-blue" href="/fees/record">
          Record payment
        </Link>
        <span className="text-border">/</span>
        <span className="text-ink">Charges and invoices are listed below</span>
        <span className="text-border">/</span>
        <span className="text-ink">Payment history</span>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <select className={selectClassName()} aria-label="Academic year" value={state.year} onChange={(event) => dispatch({ type: "set-period", year: event.target.value, term: state.term })}>
          {state.school.years.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
        <select className={selectClassName()} aria-label="Term" value={state.term} onChange={(event) => dispatch({ type: "set-period", year: state.year, term: event.target.value })}>
          {state.school.terms.map((term) => (
            <option key={term}>{term}</option>
          ))}
        </select>
        <select className={selectClassName()} aria-label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="all">All classes</option>
          {state.classes.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Surface className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Total charges</p>
          <p className="mt-2 text-[26px] font-semibold text-navy">{formatMoney(summary.charged)}</p>
        </Surface>
        <Surface className="bg-success-bg p-5">
          <p className="text-[13px] font-medium text-success">Total collected</p>
          <p className="mt-2 text-[26px] font-semibold text-success">{formatMoney(summary.collected)}</p>
        </Surface>
        <Surface className="bg-danger-bg p-5">
          <p className="text-[13px] font-medium text-danger">Outstanding balance</p>
          <p className="mt-2 text-[26px] font-semibold text-danger">{formatMoney(summary.outstanding)}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Collection rate</p>
          <p className="mt-2 text-[26px] font-semibold text-navy">{summary.rate}%</p>
          <p className="text-xs text-ink">Collected divided by charges</p>
        </Surface>
      </div>
      <Surface className="mt-4 p-5">
        <h2 className="text-lg font-semibold text-navy">Collection trend</h2>
        <div className="mt-4 h-56 min-w-0 overflow-hidden">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments match these filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                <Bar dataKey="amount" fill="var(--blue)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Surface>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Surface>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-navy">Recent payments</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 8).map((payment) => {
                  const student = state.students.find((item) => item.id === payment.studentId);
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Link className="font-medium text-blue" href={`/fees/receipts/${payment.id}`}>
                          {payment.receiptNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground sm:hidden">{formatDate(payment.date)}</p>
                      </TableCell>
                      <TableCell>{student ? studentName(student) : "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(payment.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(payment.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Surface>
        <Surface>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-navy">Outstanding fee records</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Class</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {owing.slice(0, 8).map(({ student, balance }) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      {studentName(student)}
                      <p className="text-xs text-muted-foreground sm:hidden">{className(state, student.classId)}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{className(state, student.classId)}</TableCell>
                    <TableCell className="text-right whitespace-normal">
                      <span className="mr-2 tabular-nums">{formatMoney(balance)}</span>
                      <StatusBadge tone="danger">Outstanding</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Link className="text-sm font-medium text-blue" href={`/fees/statements/${student.id}`}>
                        Statement
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Surface>
      </div>
    </div>
  );
}
