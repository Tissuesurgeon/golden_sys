"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getPaginationRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { MoreHorizontal } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Pagination,
  StatusBadge,
  Surface,
  balanceLabel,
  balanceTone,
  selectClassName,
  studentStatusTone,
} from "@/components/common/ui-bits";
import { StudentForm, toStudent } from "@/components/students/student-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, initials } from "@/lib/format";
import { canManageStudents, canViewFinance } from "@/lib/prototype/permissions";
import { className, currentStaff, studentName, studentOutstanding } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { Student } from "@/lib/prototype/types";

export function StudentDirectory() {
  const params = useSearchParams();
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const finance = canViewFinance(staff?.role ?? "teacher");
  const canAdd = canManageStudents(staff?.role ?? "teacher");
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(params.get("view") === "error");
  const [open, setOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  const rows = useMemo(() => {
    return state.students.filter((student) => {
      const haystack = `${studentName(student)} ${student.admissionNumber}`.toLowerCase();
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false;
      if (classId !== "all" && student.classId !== classId) return false;
      if (status !== "all" && student.status !== status) return false;
      if (staff?.role === "teacher" && !staff.classIds.includes(student.classId)) return false;
      return true;
    });
  }, [state.students, query, classId, status, staff]);

  const columns = useMemo<LegacyColumnDef<Student>[]>(() => {
    const base: LegacyColumnDef<Student>[] = [
      {
        id: "name",
        header: "Student",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">
              {initials(studentName(row.original))}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-ink">{studentName(row.original)}</p>
              <p className="text-xs text-muted-foreground">{row.original.sex}</p>
              <p className="text-xs text-muted-foreground md:hidden">
                {row.original.admissionNumber} · {className(state, row.original.classId)} · {row.original.status}
              </p>
            </div>
          </div>
        ),
      },
      { accessorKey: "admissionNumber", header: "Admission no." },
      { id: "class", header: "Class", cell: ({ row }) => className(state, row.original.classId) },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={studentStatusTone(row.original.status)}>
            {row.original.status[0].toUpperCase() + row.original.status.slice(1)}
          </StatusBadge>
        ),
      },
    ];
    if (finance) {
      base.push({
        id: "balance",
        header: "Balance",
        cell: ({ row }) => {
          const balance = studentOutstanding(state, row.original.id, state.year, state.term);
          return (
            <div className="text-right">
              <p className="font-medium tabular-nums text-ink">{formatMoney(balance)}</p>
              <StatusBadge tone={balanceTone(balance)}>{balanceLabel(balance)}</StatusBadge>
            </div>
          );
        },
      });
    }
    base.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="grid size-8 place-items-center rounded-lg hover:bg-muted" aria-label={`Actions for ${studentName(row.original)}`}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/students/${row.original.id}`} />}>Open profile</DropdownMenuItem>
            {finance ? (
              <DropdownMenuItem render={<Link href={`/fees/statements/${row.original.id}`} />}>Fee statement</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });
    return base;
  }, [finance, state]);

  const table = useLegacyTable({
    data: rows,
    columns,
    state: { pagination: { pageIndex: page - 1, pageSize: 8 } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex: page - 1, pageSize: 8 }) : updater;
      setPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageRows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div>
      <PageHeader
        title="Students"
        description="Admission list for Golden Child School. Teachers see only their assigned classes."
        actions={
          canAdd ? (
            <Button onClick={() => setOpen(true)}>Add student</Button>
          ) : null
        }
      />
      <Surface>
        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_180px_160px]">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or admission number"
            aria-label="Search students"
          />
          <select
            className={selectClassName()}
            aria-label="Class"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All classes</option>
            {state.classes.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          <select
            className={selectClassName()}
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="enrolled">Enrolled</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="graduated">Graduated</option>
          </select>
        </div>
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState onRetry={() => setError(false)} />
        ) : pageRows.length === 0 ? (
          <EmptyState
            title="No students match"
            body="Try another name, admission number, class, or status. New admissions appear here after they are saved in this preview."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={[header.column.id === "balance" ? "text-right" : "", ["admissionNumber", "class", "status"].includes(header.column.id) ? "hidden md:table-cell" : ""].join(" ")}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-blue-pale/60">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={["admissionNumber", "class", "status"].includes(cell.column.id) ? "hidden md:table-cell" : undefined}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          onPage={setPage}
          total={rows.length}
          from={rows.length === 0 ? 0 : (page - 1) * 8 + 1}
          to={Math.min(page * 8, rows.length)}
        />
      </Surface>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>The admission is stored in this browser preview only.</DialogDescription>
          </DialogHeader>
          <StudentForm
            classes={state.classes}
            requireGuardian
            submitLabel="Save student"
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              const duplicate = state.students.some(
                (student) => student.admissionNumber.toLowerCase() === values.admissionNumber.toLowerCase(),
              );
              if (duplicate) return "That admission number is already in use.";
              const id = `stu-${Date.now()}`;
              dispatch({
                type: "add-student",
                student: toStudent(id, values),
                guardian: {
                  id: `${id}-g1`,
                  studentId: id,
                  fullName: values.guardianName,
                  relationship: values.guardianRelationship || "Guardian",
                  phone: values.guardianPhone,
                  email: "",
                  occupation: "",
                  primary: true,
                },
              });
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
