"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, Surface, selectClassName, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { canReviewResults } from "@/lib/prototype/permissions";
import { className, configForSheet, currentStaff, studentName, subjectName, summariseRow } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function ResultsReview() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const queue = state.sheets.filter((sheet) => sheet.status === "submitted" || sheet.status === "approved" || sheet.status === "returned");
  const [sheetId, setSheetId] = useState(queue.find((sheet) => sheet.status === "submitted")?.id ?? queue[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const config = sheet ? configForSheet(state, sheet) : null;

  if (!staff || !canReviewResults(staff.role)) {
    return <Surface className="p-8 text-sm">Only a school administrator can approve or return results.</Surface>;
  }

  const warnings =
    sheet && config
      ? sheet.rows.flatMap((row) => {
          const student = state.students.find((item) => item.id === row.studentId);
          const summary = summariseRow(config.components, row.scores, state.school.grading);
          if (summary.missing.length === 0) return [];
          return [`${student ? studentName(student) : "Student"} is missing ${summary.missing.join(", ")}.`];
        })
      : [];

  return (
    <div>
      <PageHeader title="Results review" description="Approval does not publish the report card. Publication is a separate step." />
      <Surface className="p-5">
        <label className="block max-w-md space-y-1.5 text-sm">
          Mark sheet
          <select className={selectClassName()} value={sheet?.id ?? ""} onChange={(event) => setSheetId(event.target.value)}>
            {queue.map((item) => {
              const itemConfig = configForSheet(state, item);
              return (
                <option key={item.id} value={item.id}>
                  {itemConfig ? `${className(state, itemConfig.classId)} · ${subjectName(state, itemConfig.subjectId)} · ${sheetStatusLabel(item.status)}` : item.id}
                </option>
              );
            })}
          </select>
        </label>
        {sheet && config ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              <StatusBadge tone={sheetStatusTone(sheet.status)}>{sheetStatusLabel(sheet.status)}</StatusBadge>
              <span className="text-sm text-muted-foreground">
                {className(state, config.classId)} · {subjectName(state, config.subjectId)}
              </span>
            </div>
            {warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 rounded-xl bg-warning-bg px-4 py-3 text-sm text-ink">
                {warnings.map((warning) => (
                  <li key={warning}>{warning} Missing marks are not zero.</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-success">Every student has a mark in each component.</p>
            )}
            <div className="mt-4 max-w-full overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="sticky left-0 bg-white py-2 pr-3">Student</th>
                    {config.components.map((component) => (
                      <th key={component.id} className="py-2">{component.name}</th>
                    ))}
                    <th className="py-2">Total</th>
                    <th className="py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row) => {
                    const student = state.students.find((item) => item.id === row.studentId);
                    const summary = summariseRow(config.components, row.scores, state.school.grading);
                    return (
                      <tr key={row.studentId} className="border-b border-border">
                        <td className="sticky left-0 bg-white py-2 pr-3 font-medium">{student ? studentName(student) : "Student"}</td>
                        {config.components.map((component) => (
                          <td key={component.id} className="py-2">{row.scores[component.id] == null ? "Missing" : row.scores[component.id]}</td>
                        ))}
                        <td className="py-2">{summary.total ?? "—"}</td>
                        <td className="py-2">{summary.grade ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {note ? <p className="mt-3 text-sm text-success">{note}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={sheet.status !== "submitted" || warnings.length > 0}
                onClick={() => {
                  dispatch({ type: "approve-marks", sheetId: sheet.id });
                  setNote("Results approved. They are not published yet.");
                }}
              >
                Approve results
              </Button>
              <Button type="button" variant="outline" disabled={sheet.status !== "submitted"} onClick={() => setOpen(true)}>
                Return for correction
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nothing is waiting for review.</p>
        )}
      </Surface>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return for correction</DialogTitle>
            <DialogDescription>Tell the teacher what to correct. Approval stays separate from this return.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for return" />
          <Button
            type="button"
            disabled={reason.trim().length < 8 || !sheet}
            onClick={() => {
              if (!sheet) return;
              dispatch({ type: "return-marks", sheetId: sheet.id, reason: reason.trim() });
              setNote("Returned to the teacher.");
              setReason("");
              setOpen(false);
            }}
          >
            Return sheet
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
