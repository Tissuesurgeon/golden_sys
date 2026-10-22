"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader, Pagination, StatusBadge, Surface } from "@/components/common/ui-bits";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AdmissionRow = {
  id: string;
  name: string;
  number: string;
  className: string;
  status: string;
  invoiceNumber: string | null;
  invoiceTotal: number | null;
  invoiceStatus: string | null;
};

const pageSize = 8;

const statusLabel: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  deferred: "Deferred",
  rejected: "Rejected",
  enrolled: "Enrolled",
};

function statusTone(status: string) {
  if (status === "enrolled") return "navy" as const;
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "draft") return "neutral" as const;
  return "warning" as const;
}

export function AdmissionsDirectory({ rows, canCreate }: { rows: AdmissionRow[]; canCreate: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "waiting" | "accepted" | "enrolled">("all");
  const [page, setPage] = useState(1);

  const waiting = rows.filter((row) => row.status === "submitted" || row.status === "under_review").length;
  const accepted = rows.filter((row) => row.status === "accepted").length;
  const enrolled = rows.filter((row) => row.status === "enrolled").length;

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "waiting" && row.status !== "submitted" && row.status !== "under_review") return false;
      if (filter === "accepted" && row.status !== "accepted") return false;
      if (filter === "enrolled" && row.status !== "enrolled") return false;
      if (!needle) return true;
      return `${row.name} ${row.number} ${row.className}`.toLowerCase().includes(needle);
    });
  }, [rows, query, filter]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function choose(next: typeof filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Applications, decisions, admission invoices, and enrollment."
        actions={
          canCreate ? (
            <Link href="/admissions/new" className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
              New application
            </Link>
          ) : null
        }
      />
      <Surface>
        <div className="grid border-b border-border sm:grid-cols-4">
          <FilterStat label="Applications" value={rows.length} pressed={filter === "all"} onClick={() => choose("all")} />
          <FilterStat label="Awaiting decision" value={waiting} pressed={filter === "waiting"} onClick={() => choose("waiting")} />
          <FilterStat label="Accepted" value={accepted} pressed={filter === "accepted"} onClick={() => choose("accepted")} />
          <FilterStat label="Enrolled" value={enrolled} pressed={filter === "enrolled"} onClick={() => choose("enrolled")} />
        </div>
        <div className="border-b border-border p-4">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, application number, or class"
            aria-label="Search applications"
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No applications yet" body="A new application can be saved as a draft or submitted for a decision." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No applications match" body="Try another name or application number. Choose Applications above to clear the filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead className="hidden sm:table-cell">Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-blue-pale/60">
                  <TableCell>
                    <Link className="font-medium text-blue" href={`/admissions/${row.id}`}>{row.name}</Link>
                    <p className="text-xs text-muted-foreground">{row.number}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{row.className}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{row.className}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(row.status)}>{statusLabel[row.status] ?? row.status}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {row.invoiceNumber ? (
                      <div>
                        <p className="font-medium text-ink">{row.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(row.invoiceTotal ?? 0)} · {row.invoiceStatus}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No invoice</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
          total={visibleRows.length}
          from={visibleRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          to={Math.min(currentPage * pageSize, visibleRows.length)}
        />
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
