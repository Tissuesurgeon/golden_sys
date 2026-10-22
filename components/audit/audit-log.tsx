"use client";

import { useMemo, useState } from "react";
import { EmptyState, PageHeader, Surface } from "@/components/common/ui-bits";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type AuditRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  summary: string;
};

const labels: Record<string, string> = {
  "application.saved": "Application saved",
  "application.submitted": "Application submitted",
  "application.decided": "Decision recorded",
  "invoice.issued": "Invoice issued",
  "invoice.waived": "Balance waived",
  "payment.recorded": "Payment recorded",
  "payment.reversed": "Payment reversed",
  "student.enrolled": "Student enrolled",
  "student.created": "Student added",
  "student.updated": "Student updated",
  "guardian.linked": "Guardian linked",
  "results.published": "Results published",
  "results.amended": "Results amended",
  "staff.invited": "Staff invited",
  "staff.updated": "Staff updated",
  "school.updated": "School settings updated",
  "password_reset.issued": "Password reset issued",
};

function groupOf(action: string) {
  if (action.startsWith("application.") || action === "student.enrolled") return "admissions";
  if (action.startsWith("payment.") || action.startsWith("invoice.")) return "money";
  if (action.startsWith("results.")) return "results";
  return "people";
}

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "admissions" | "money" | "results" | "people">("all");

  const counts = {
    all: rows.length,
    admissions: rows.filter((row) => groupOf(row.action) === "admissions").length,
    money: rows.filter((row) => groupOf(row.action) === "money").length,
    results: rows.filter((row) => groupOf(row.action) === "results").length,
    people: rows.filter((row) => groupOf(row.action) === "people").length,
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && groupOf(row.action) !== filter) return false;
      if (!needle) return true;
      return `${row.actor} ${row.action} ${labels[row.action] ?? ""} ${row.summary}`.toLowerCase().includes(needle);
    });
  }, [rows, query, filter]);

  return (
    <div>
      <PageHeader title="Audit log" description="Append-only record of money, admissions, results, and account changes. The latest 200 events are shown." />
      <Surface>
        <div className="grid border-b border-border sm:grid-cols-5">
          <FilterStat label="All events" value={counts.all} pressed={filter === "all"} onClick={() => setFilter("all")} />
          <FilterStat label="Admissions" value={counts.admissions} pressed={filter === "admissions"} onClick={() => setFilter("admissions")} />
          <FilterStat label="Money" value={counts.money} pressed={filter === "money"} onClick={() => setFilter("money")} />
          <FilterStat label="Results" value={counts.results} pressed={filter === "results"} onClick={() => setFilter("results")} />
          <FilterStat label="People and accounts" value={counts.people} pressed={filter === "people"} onClick={() => setFilter("people")} />
        </div>
        <div className="border-b border-border p-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by person, action, or detail" aria-label="Search audit log" />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No audit events yet" body="Enrollment, payments, published results, and account changes will be listed here." />
        ) : visible.length === 0 ? (
          <EmptyState title="No events match" body="Try another name or action. Choose All events to clear the filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{when(row.at)}</TableCell>
                  <TableCell className="font-medium text-ink">{row.actor}</TableCell>
                  <TableCell>
                    <p className="font-medium text-ink">{labels[row.action] ?? row.action}</p>
                    <p className="text-xs text-muted-foreground">{row.summary}</p>
                    <p className="text-[11px] text-muted-foreground">{row.action}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Surface>
    </div>
  );
}

function FilterStat({ label, value, pressed, onClick }: { label: string; value: number; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted sm:border-r sm:border-b-0 sm:last:border-r-0",
        pressed && "bg-blue-pale",
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-navy">{value}</span>
    </button>
  );
}
