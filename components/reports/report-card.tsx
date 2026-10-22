"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentHeader } from "@/components/print/document-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/common/ui-bits";
import { className, configForSheet, currentStaff, staffById, studentName, subjectName, summariseRow } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function ReportCardView({ studentId }: { studentId: string }) {
  const params = useSearchParams();
  const { state } = usePrototype();
  const student = state.students.find((item) => item.id === studentId);
  const staff = currentStaff(state);
  const room = state.classes.find((item) => item.id === student?.classId);
  const teacher = staffById(state, room?.teacherId ?? null);
  const sections = state.sheets
    .map((sheet) => ({ sheet, config: configForSheet(state, sheet) }))
    .filter((item) => item.config && item.config.classId === student?.classId && item.config.year === state.year && item.config.term === state.term)
    .filter((item) => item.sheet.status === "approved" || item.sheet.status === "published" || item.sheet.status === "submitted");
  const printable = sections.filter((item) => item.sheet.status === "approved" || item.sheet.status === "published");
  const awaiting = sections.filter((item) => item.sheet.status === "submitted");
  useEffect(() => {
    if (params.get("print") === "1" && printable.length > 0) window.print();
  }, [params, printable.length]);

  if (!student || !staff || staff.role === "bursar") {
    return <Surface className="p-8 text-sm">This report card is not available.</Surface>;
  }
  if (staff.role === "teacher" && !staff.classIds.includes(student.classId)) {
    return <Surface className="p-8 text-sm">This class is outside your assignment.</Surface>;
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        {printable.length > 0 ? (
          <>
            <Button type="button" onClick={() => window.print()}>
              Print report card
            </Button>
            <a className="text-sm font-medium text-blue" href={`/api/pdf/report/${student.id}`}>
              Download PDF
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Print stays off until a subject is approved.</p>
        )}
      </div>
      <article className="print-sheet mx-auto w-full max-w-[210mm] rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgb(16_46_99/0.04)] sm:p-8">
        <DocumentHeader school={state.school} kicker={`${state.term} report card · ${state.year}`} />
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Student</dt>
            <dd className="font-medium">{studentName(student)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Admission number</dt>
            <dd>{student.admissionNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Class</dt>
            <dd>{className(state, student.classId)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sex</dt>
            <dd>{student.sex}</dd>
          </div>
        </dl>
        {printable.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No reviewed results are available for this term.</p>
        ) : (
          printable.map(({ sheet, config }) => {
            if (!config) return null;
            const row = sheet.rows.find((item) => item.studentId === student.id);
            if (!row) return null;
            const summary = summariseRow(config.components, row.scores, state.school.grading);
            return (
              <section key={sheet.id} className="mt-6">
                <h2 className="text-base font-semibold text-navy">{subjectName(state, config.subjectId)}</h2>
                <div className="mt-2 max-w-full overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      {config.components.map((component) => (
                        <th key={component.id} className="py-2 font-medium">
                          {component.name}
                          <span className="block font-normal">/ {component.max}</span>
                        </th>
                      ))}
                      <th className="py-2 font-medium">Total</th>
                      <th className="py-2 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {config.components.map((component) => (
                        <td key={component.id} className="py-2">{row.scores[component.id] == null ? "Missing" : row.scores[component.id]}</td>
                      ))}
                      <td className="py-2">{summary.total ?? "—"}</td>
                      <td className="py-2">{summary.grade ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Class teacher remark. </span>
                  {row.remark ?? " "}
                </p>
              </section>
            );
          })
        )}
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="h-px bg-navy" />
            <p className="mt-2 text-xs text-muted-foreground">Class teacher{teacher ? ` · ${teacher.name}` : ""}</p>
          </div>
          <div>
            <div className="h-px bg-navy" />
            <p className="mt-2 text-xs text-muted-foreground">Headteacher</p>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">{state.school.motto}</p>
      </article>
      {awaiting.length > 0 ? (
        <p className="no-print mx-auto mt-4 max-w-[210mm] text-sm text-muted-foreground">
          {awaiting.length} subject {awaiting.length === 1 ? "sheet is" : "sheets are"} still awaiting review, so {awaiting.length === 1 ? "it is" : "they are"} left off this card.
        </p>
      ) : null}
    </div>
  );
}
