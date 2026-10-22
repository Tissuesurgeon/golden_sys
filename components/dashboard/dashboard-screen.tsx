"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, StatusBadge, Surface, balanceLabel, balanceTone, selectClassName } from "@/components/common/ui-bits";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney, greeting, initials } from "@/lib/format";
import { canViewFinance } from "@/lib/prototype/permissions";
import {
  className,
  currentStaff,
  financeSummary,
  recentActivity,
  periodBounds,
  studentName,
  studentOutstanding,
} from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import { cn } from "@/lib/utils";

function weekStart(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function DashboardScreen() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const finance = canViewFinance(staff?.role ?? "teacher");
  const summary = financeSummary(state, state.year, state.term);
  const enrolled = state.students.filter((student) => student.status === "enrolled");
  const mine = staff?.role === "teacher" ? enrolled.filter((student) => staff.classIds.includes(student.classId)) : enrolled;

  const chartWindow = periodBounds(state.year, state.term);
  const chart = Object.entries(
    state.payments
      .filter((payment) => {
        const { start, end } = chartWindow;
        return payment.date >= start && payment.date <= end;
      })
      .reduce<Record<string, number>>((groups, payment) => {
        const key = weekStart(payment.date);
        groups[key] = (groups[key] ?? 0) + payment.amount;
        return groups;
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, amount]) => ({ week: formatDate(week), amount: amount / 100 }));

  const owing = state.students
    .map((student) => ({ student, balance: studentOutstanding(state, student.id, state.year, state.term) }))
    .filter((item) => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const recentStudents = [...state.students].sort((a, b) => b.enrolledOn.localeCompare(a.enrolledOn)).slice(0, 5);
  const activity = recentActivity(state).filter((item) => (finance ? true : !item.title.startsWith("Payment")));

  const submitted = state.sheets.filter((sheet) => sheet.status === "submitted").length;
  const drafts = state.sheets.filter((sheet) => sheet.status === "draft" || sheet.status === "returned").length;
  const published = state.sheets.filter((sheet) => sheet.status === "published").length;

  const actions = finance
    ? [
        { href: "/students", title: "Add a student", detail: "Admission number, class, and guardian" },
        { href: "/fees/record", title: "Record a payment", detail: "Allocate cash or mobile money to open charges" },
        { href: "/report-cards", title: "Open report cards", detail: "Preview cards that are ready to print" },
      ]
    : [
        { href: "/academics/marks", title: "Enter marks", detail: "Class exercise, homework, mid-term, and exam" },
        { href: "/report-cards", title: "View report cards", detail: "Published results for your classes" },
        { href: "/students", title: "Find a student", detail: "Admission number or class list" },
      ];

  if (staff?.role === "administrator") {
    actions.splice(2, 0, { href: "/academics/marks", title: "Enter marks", detail: "Open a class mark sheet" });
  }

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${staff?.name.split(" ")[0] ?? "there"}`}
        description={`${state.school.name} · ${state.term}, ${state.year}`}
        actions={
          <div className="flex gap-2">
            <select
              className={cn(selectClassName(), "w-[9.5rem] shrink-0 pr-8 tabular-nums")}
              aria-label="Academic year"
              value={state.year}
              onChange={(event) => dispatch({ type: "set-period", year: event.target.value, term: state.term })}
            >
              {state.school.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className={cn(selectClassName(), "w-[7.5rem] shrink-0 pr-8")}
              aria-label="Term"
              value={state.term}
              onChange={(event) => dispatch({ type: "set-period", year: state.year, term: event.target.value })}
            >
              {state.school.terms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {finance ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Surface className="p-5">
            <p className="text-[13px] font-medium text-muted-foreground">Total students</p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-navy">{enrolled.length}</p>
            <p className="mt-1 text-xs text-ink">Enrolled this year</p>
          </Surface>
          <Surface className="p-5">
            <p className="text-[13px] font-medium text-muted-foreground">Total fees charged</p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-navy">{formatMoney(summary.charged)}</p>
            <p className="mt-1 text-xs text-ink">{state.term} invoices</p>
          </Surface>
          <Surface className="bg-success-bg p-5">
            <p className="text-[13px] font-medium text-success">Payments received</p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-success">{formatMoney(summary.collected)}</p>
            <p className="mt-1 text-xs text-ink">Collected against {state.term} charges</p>
          </Surface>
          <Surface className="bg-danger-bg p-5">
            <p className="text-[13px] font-medium text-danger">Outstanding balance</p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight text-danger">{formatMoney(summary.outstanding)}</p>
            <p className="mt-1 text-xs text-ink">Unpaid after adjustments</p>
          </Surface>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Surface className="p-5">
            <p className="text-[13px] font-medium text-muted-foreground">My students</p>
            <p className="mt-3 text-[28px] font-semibold text-navy">{mine.length}</p>
            <p className="mt-1 text-xs text-ink">Enrolled in assigned classes</p>
          </Surface>
          <Surface className="p-5">
            <p className="text-[13px] font-medium text-muted-foreground">Mark sheets in draft</p>
            <p className="mt-3 text-[28px] font-semibold text-navy">{drafts}</p>
            <p className="mt-1 text-xs text-ink">Still being entered</p>
          </Surface>
          <Surface className="bg-blue-pale p-5">
            <p className="text-[13px] font-medium text-blue">Awaiting review</p>
            <p className="mt-3 text-[28px] font-semibold text-navy">{submitted}</p>
            <p className="mt-1 text-xs text-ink">Submitted, not yet approved</p>
          </Surface>
          <Surface className="bg-success-bg p-5">
            <p className="text-[13px] font-medium text-success">Published results</p>
            <p className="mt-3 text-[28px] font-semibold text-success">{published}</p>
            <p className="mt-1 text-xs text-ink">Released on report cards</p>
          </Surface>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          {finance ? (
            <Surface className="p-5">
              <h2 className="text-lg font-semibold text-navy">Fee collection</h2>
              <p className="mt-1 text-sm text-muted-foreground">Weekly receipts recorded for {state.term}, {state.year}.</p>
              <div className="mt-4 h-64 min-w-0 overflow-hidden">
                {chart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments have been recorded for this term.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                      <Bar dataKey="amount" fill="var(--blue)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Surface>
          ) : null}

          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">Recent activity</h2>
            <ul className="mt-4 divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </li>
              ))}
            </ul>
          </Surface>
        </div>

        <div className="space-y-4">
          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">Quick actions</h2>
            <ul className="mt-3 space-y-2">
              {actions.map((action) => (
                <li key={action.href + action.title}>
                  <Link href={action.href} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-blue-pale">
                    <span>
                      <span className="block text-sm font-medium text-navy">{action.title}</span>
                      <span className="block text-xs text-muted-foreground">{action.detail}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-lg font-semibold text-navy">Recent students</h2>
            <ul className="mt-3 space-y-3">
              {recentStudents.map((student) => (
                <li key={student.id}>
                  <Link href={`/students/${student.id}`} className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-blue-pale text-xs font-semibold text-navy">
                      {initials(studentName(student))}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{studentName(student)}</span>
                      <span className="block text-xs text-muted-foreground">{className(state, student.classId)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Surface>

          {finance ? (
            <Surface className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-navy">Outstanding fees</h2>
                <Link href="/fees" className={cn(buttonVariants({ variant: "link" }), "h-auto px-0")}>
                  Open fees
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {owing.map(({ student, balance }) => (
                  <li key={student.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{studentName(student)}</p>
                      <p className="text-xs text-muted-foreground">{className(state, student.classId)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-danger">{formatMoney(balance)}</p>
                      <StatusBadge tone={balanceTone(balance)}>{balanceLabel(balance)}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}
        </div>
      </div>
    </div>
  );
}
