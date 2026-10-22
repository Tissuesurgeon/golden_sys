"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader, Pagination, StatusBadge, Surface, studentStatusTone } from "@/components/common/ui-bits";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GuardianStudent = {
  id: string;
  name: string;
  className: string;
  relationship: string;
  primary: boolean;
  status: string;
};

export type GuardianRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  occupation: string;
  students: GuardianStudent[];
};

const pageSize = 8;

function statusLabel(status: string) {
  if (status === "active") return "Enrolled";
  return status[0].toUpperCase() + status.slice(1);
}

export function GuardianDirectory({ guardians }: { guardians: GuardianRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "shared" | "missing-email">("all");
  const [page, setPage] = useState(1);

  const sharedCount = guardians.filter((guardian) => guardian.students.length > 1).length;
  const missingEmail = guardians.filter((guardian) => !guardian.email).length;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return guardians.filter((guardian) => {
      if (filter === "shared" && guardian.students.length < 2) return false;
      if (filter === "missing-email" && guardian.email) return false;
      if (!needle) return true;
      const haystack = [guardian.fullName, guardian.phone, guardian.email, guardian.occupation, ...guardian.students.map((student) => `${student.name} ${student.className}`)]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(needle)) return true;
      return digits.length >= 3 && guardian.phone.replace(/\D/g, "").includes(digits);
    });
  }, [guardians, query, filter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function choose(next: typeof filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Parents and Guardians"
        description="Each person is stored once and linked to every student they are responsible for."
      />
      <Surface>
        <div className="grid border-b border-border sm:grid-cols-3">
          <FilterStat label="Guardians" value={guardians.length} pressed={filter === "all"} onClick={() => choose("all")} />
          <FilterStat label="Shared across students" value={sharedCount} pressed={filter === "shared"} onClick={() => choose("shared")} />
          <FilterStat label="Missing an email" value={missingEmail} pressed={filter === "missing-email"} onClick={() => choose("missing-email")} />
        </div>
        <div className="border-b border-border p-4">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone, or student"
            aria-label="Search guardians"
          />
        </div>
        {guardians.length === 0 ? (
          <EmptyState title="No guardians yet" body="Guardians appear here when a student record includes a parent or guardian." />
        ) : visible.length === 0 ? (
          <EmptyState title="No guardians match" body="Try another name, phone number, or student. Choose Guardians above to clear the filter." />
        ) : (
          <>
          <ul className="divide-y divide-border md:hidden">
            {visible.map((guardian) => (
              <li key={guardian.id} className="space-y-3 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">
                    {initials(guardian.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{guardian.fullName}</p>
                    <p className="text-xs text-muted-foreground">{guardian.occupation || "Occupation not recorded"}</p>
                  </div>
                </div>
                <p className="text-sm">
                  {guardian.phone ? (
                    <a className="font-medium text-blue" href={`tel:${guardian.phone.replace(/\s/g, "")}`}>{guardian.phone}</a>
                  ) : (
                    <span className="text-muted-foreground">No phone</span>
                  )}
                  <span className="text-muted-foreground"> · </span>
                  {guardian.email ? (
                    <a className="text-blue" href={`mailto:${guardian.email}`}>{guardian.email}</a>
                  ) : (
                    <span className="text-muted-foreground">No email</span>
                  )}
                </p>
                <StudentLinks guardian={guardian} />
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guardian</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Students</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((guardian) => (
                <TableRow key={guardian.id} className="hover:bg-blue-pale/60">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">
                        {initials(guardian.fullName)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{guardian.fullName}</p>
                        <p className="text-xs text-muted-foreground">{guardian.occupation || "Occupation not recorded"}</p>
                        {guardian.email ? <p className="truncate text-xs text-muted-foreground md:hidden">{guardian.email}</p> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {guardian.phone ? (
                      <a className="font-medium text-blue" href={`tel:${guardian.phone.replace(/\s/g, "")}`}>
                        {guardian.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No phone</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {guardian.email ? (
                      <a className="text-blue" href={`mailto:${guardian.email}`}>
                        {guardian.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No email</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StudentLinks guardian={guardian} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
          total={rows.length}
          from={rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          to={Math.min(currentPage * pageSize, rows.length)}
        />
      </Surface>
    </div>
  );
}

function StudentLinks({ guardian }: { guardian: GuardianRow }) {
  if (guardian.students.length === 0) return <span className="text-sm text-muted-foreground">No student linked</span>;
  return (
    <ul className="space-y-2">
      {guardian.students.map((student) => (
        <li key={student.id} className="min-w-0">
          <Link className="font-medium text-blue" href={`/students/${student.id}`}>
            {student.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {student.relationship}
            {student.className ? ` · ${student.className}` : ""}
          </p>
          {(guardian.students.length > 1 && student.primary) || student.status !== "active" ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {guardian.students.length > 1 && student.primary ? <StatusBadge tone="info">Primary</StatusBadge> : null}
              {student.status !== "active" ? <StatusBadge tone={studentStatusTone(student.status)}>{statusLabel(student.status)}</StatusBadge> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
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
