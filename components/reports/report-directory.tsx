"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader, StatusBadge, Surface, selectClassName, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { className, configForSheet, currentStaff, studentName, teacherCanAccessClass } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function ReportDirectory() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const [classId, setClassId] = useState("all");
  const [publication, setPublication] = useState("all");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const rows = useMemo(() => {
    return state.students
      .filter((student) => student.status === "enrolled")
      .filter((student) => classId === "all" || student.classId === classId)
      .filter((student) => staff?.role !== "teacher" || staff.classIds.includes(student.classId))
      .map((student) => {
        const sheets = state.sheets.filter((sheet) => {
          const config = configForSheet(state, sheet);
          if (!config || config.classId !== student.classId || config.year !== state.year || config.term !== state.term) return false;
          return teacherCanAccessClass(state, config.classId, config.subjectId) || staff?.role === "administrator";
        });
        const published = sheets.length > 0 && sheets.every((sheet) => sheet.status === "published");
        const approved = sheets.some((sheet) => sheet.status === "approved" || sheet.status === "published");
        const status = published ? "published" : approved ? "approved" : sheets.some((sheet) => sheet.status === "submitted") ? "submitted" : "draft";
        return { student, sheets, status };
      })
      .filter((row) => publication === "all" || row.status === publication);
  }, [state, classId, publication, staff]);

  if (!staff || staff.role === "bursar") {
    return <Surface className="p-8 text-sm">Report cards are part of the academic workspace.</Surface>;
  }

  return (
    <div>
      <PageHeader title="Report cards" description={`${state.term}, ${state.year}. Preview is available when a subject has marks. Print is for approved or published results.`} />
      <div className="mb-4 grid gap-2 md:grid-cols-4">
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
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        <select className={selectClassName()} aria-label="Publication status" value={publication} onChange={(event) => setPublication(event.target.value)}>
          <option value="all">All publication states</option>
          <option value="draft">Draft</option>
          <option value="submitted">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {note ? <p className="mb-3 text-sm text-success">{note}</p> : null}
      <Surface>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Admission no.</TableHead>
                <TableHead className="hidden sm:table-cell">Class</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="hidden lg:table-cell">Report card</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ student, status }) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <p className="font-medium text-ink">{studentName(student)}</p>
                    <p className="text-xs text-muted-foreground md:hidden">
                      {student.admissionNumber} · {className(state, student.classId)}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{student.admissionNumber}</TableCell>
                  <TableCell className="hidden sm:table-cell">{className(state, student.classId)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={sheetStatusTone(status)}>{sheetStatusLabel(status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{status === "published" ? "Ready to print" : status === "approved" ? "Approved, not published" : "Not published"}</TableCell>
                  <TableCell className="text-right whitespace-normal">
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    <Link className="text-sm font-medium text-blue" href={`/report-cards/${student.id}`}>Preview</Link>
                    {status === "published" || status === "approved" ? (
                      <Link className="text-sm font-medium text-blue" href={`/report-cards/${student.id}?print=1`}>Print</Link>
                    ) : null}
                    <Link className="text-sm font-medium text-blue" href={`/students/${student.id}`}>Profile</Link>
                    {staff.role === "administrator" && status === "approved" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setError("");
                          setNote("");
                          const sheets = state.sheets.filter((sheet) => {
                            const config = configForSheet(state, sheet);
                            return config?.classId === student.classId && config.year === state.year && config.term === state.term && sheet.status === "approved";
                          });
                          if (sheets.length === 0) {
                            setError("Approve the mark sheet before publishing it.");
                            return;
                          }
                          for (const sheet of sheets) {
                            const message = await dispatch({ type: "publish-sheet", sheetId: sheet.id });
                            if (message) {
                              setError(message);
                              return;
                            }
                          }
                          setNote("Report card published.");
                        }}
                      >
                        Publish
                      </Button>
                    ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Surface>
    </div>
  );
}
