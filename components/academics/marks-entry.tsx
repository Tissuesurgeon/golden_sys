"use client";

import { useState } from "react";
import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { studentName, className, subjectName, configForSheet, currentStaff, summariseRow, teacherCanAccessClass } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import { canEnterMarks } from "@/lib/prototype/permissions";

type DraftScore = Record<string, string>;

export function MarksEntry() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const sheets = state.sheets.filter((sheet) => {
    const config = configForSheet(state, sheet);
    if (!config || config.year !== state.year || config.term !== state.term) return false;
    return teacherCanAccessClass(state, config.classId, config.subjectId);
  });
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? "");
  const sheet = state.sheets.find((item) => item.id === sheetId) ?? sheets[0];
  const config = sheet ? configForSheet(state, sheet) : null;
  const [draft, setDraft] = useState<Record<string, DraftScore>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const locked = sheet ? sheet.status === "submitted" || sheet.status === "approved" || sheet.status === "published" : true;

  const rows =
    !sheet || !config
      ? []
      : sheet.rows.map((row) => {
          const student = state.students.find((item) => item.id === row.studentId);
          const local = draft[row.studentId];
          const scores = Object.fromEntries(
            config.components.map((component) => {
              const raw = local?.[component.id];
              if (raw === undefined) return [component.id, row.scores[component.id] ?? null];
              if (raw.trim() === "") return [component.id, null];
              const value = Number(raw);
              return [component.id, Number.isFinite(value) ? value : null];
            }),
          );
          return { row, student, scores, summary: summariseRow(config.components, scores, state.school.grading) };
        });

  if (!staff || !canEnterMarks(staff.role)) {
    return <Surface className="p-8 text-sm">Marks entry is for teachers and administrators.</Surface>;
  }

  function cellValue(studentId: string, componentId: string, stored: number | null) {
    const raw = draft[studentId]?.[componentId];
    if (raw !== undefined) return raw;
    return stored == null ? "" : String(stored);
  }

  function invalid(raw: string, max: number) {
    if (raw.trim() === "") return "";
    if (!/^\d+$/.test(raw.trim())) return "Enter a whole number.";
    const value = Number(raw);
    if (value < 0 || value > max) return `Use 0 to ${max}.`;
    return "";
  }

  function focusCell(rowIndex: number, colIndex: number) {
    document.querySelector<HTMLInputElement>(`[data-mark="${rowIndex}-${colIndex}"]`)?.focus();
  }

  async function save(submit: boolean) {
    if (!sheet || !config) return;
    setError("");
    for (const entry of rows) {
      for (const component of config.components) {
        const raw = cellValue(entry.row.studentId, component.id, entry.row.scores[component.id] ?? null);
        if (invalid(raw, component.max)) {
          setError(`Check ${entry.student ? studentName(entry.student) : "a student"} · ${component.name}.`);
          return;
        }
      }
    }
    const nextRows = rows.map((entry) => ({
      ...entry.row,
      scores: entry.scores,
    }));
    const saved = await dispatch({ type: "save-marks", sheetId: sheet.id, rows: nextRows });
    if (saved) {
      setError(saved);
      return;
    }
    if (submit) {
      const submitted = await dispatch({ type: "submit-marks", sheetId: sheet.id });
      if (submitted) {
        setError(submitted);
        return;
      }
    }
    setDraft({});
    setMessage(submit ? "Submitted for review." : "Draft saved.");
  }

  return (
    <div>
      <PageHeader
        title="Marks entry"
        description="Leave a cell empty when the mark is missing. An empty cell is not zero."
        actions={
          <select
            className={selectClassName() + " w-full sm:w-72"}
            aria-label="Mark sheet"
            value={sheet?.id ?? ""}
            onChange={(event) => {
              setSheetId(event.target.value);
              setDraft({});
              setMessage("");
            }}
          >
            {sheets.map((item) => {
              const itemConfig = configForSheet(state, item);
              return (
                <option key={item.id} value={item.id}>
                  {itemConfig ? `${className(state, itemConfig.classId)} · ${subjectName(state, itemConfig.subjectId)}` : item.id}
                </option>
              );
            })}
          </select>
        }
      />
      {sheet && config ? (
        <Surface className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-navy">
                {className(state, config.classId)} · {subjectName(state, config.subjectId)} · {config.term}
              </p>
              {sheet.returnReason ? <p className="text-sm text-danger">Returned: {sheet.returnReason}</p> : null}
            </div>
            <StatusBadge tone={sheetStatusTone(sheet.status)}>{sheetStatusLabel(sheet.status)}</StatusBadge>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-white px-2 py-2 font-medium">Student</th>
                  {config.components.map((component) => (
                    <th key={component.id} className="px-2 py-2 font-medium">
                      {component.name}
                      <span className="block font-normal">out of {component.max}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, rowIndex) => (
                  <tr key={entry.row.studentId} className="border-b border-border">
                    <td className="sticky left-0 z-10 bg-white px-2 py-2 font-medium">{entry.student ? studentName(entry.student) : "Student"}</td>
                    {config.components.map((component, colIndex) => {
                      const raw = cellValue(entry.row.studentId, component.id, entry.row.scores[component.id] ?? null);
                      const problem = invalid(raw, component.max);
                      const missing = raw.trim() === "";
                      return (
                        <td key={component.id} className="px-2 py-2">
                          <input
                            data-mark={`${rowIndex}-${colIndex}`}
                            disabled={locked}
                            value={raw}
                            aria-label={`${entry.student ? studentName(entry.student) : "Student"} ${component.name}`}
                            aria-invalid={Boolean(problem)}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                [entry.row.studentId]: { ...current[entry.row.studentId], [component.id]: event.target.value },
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "ArrowDown" || event.key === "Enter") {
                                event.preventDefault();
                                focusCell(rowIndex + 1, colIndex);
                              }
                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                focusCell(rowIndex - 1, colIndex);
                              }
                              if (event.key === "ArrowRight" && event.currentTarget.selectionStart === event.currentTarget.value.length) {
                                focusCell(rowIndex, colIndex + 1);
                              }
                            }}
                            className={`h-10 w-20 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${problem ? "border-danger bg-danger-bg" : missing ? "border-warning bg-warning-bg" : "border-input bg-white"}`}
                          />
                          {problem ? <span className="mt-1 block text-[11px] text-danger">{problem}</span> : null}
                          {!problem && missing ? <span className="mt-1 block text-[11px] text-warning">Missing</span> : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 tabular-nums">{entry.summary.total ?? "—"}</td>
                    <td className="px-2 py-2">{entry.summary.grade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={locked} onClick={() => save(false)}>
              Save draft
            </Button>
            <Button type="button" disabled={locked} onClick={() => save(true)}>
              Submit for review
            </Button>
            <LinkButton variant="outline" href="/academics/review">
              Preview results
            </LinkButton>
          </div>
          {locked ? <p className="mt-3 text-xs text-muted-foreground">This sheet is {sheetStatusLabel(sheet.status).toLowerCase()} and cannot be edited here.</p> : null}
          <div className="mt-4">
          </div>
        </Surface>
      ) : (
        <Surface className="p-6 text-sm text-muted-foreground">No mark sheet is available for your classes this term.</Surface>
      )}
    </div>
  );
}
