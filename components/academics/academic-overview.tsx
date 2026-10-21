"use client";

import { LinkButton, PageHeader, StatusBadge, Surface, selectClassName, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canConfigureAcademics, canEnterMarks, canReviewResults } from "@/lib/prototype/permissions";
import { className, configForSheet, currentStaff, subjectName, summariseRow, teacherCanAccessClass } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import { cn } from "@/lib/utils";

export function AcademicOverview() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  if (!staff || staff.role === "bursar") {
    return <Surface className="p-8 text-sm">Academic records are not part of the bursar workspace.</Surface>;
  }

  const visible = state.sheets.filter((sheet) => {
    const config = configForSheet(state, sheet);
    if (!config || config.year !== state.year || config.term !== state.term) return false;
    return teacherCanAccessClass(state, config.classId, config.subjectId);
  });

  const configured = state.configs.filter((config) => config.year === state.year && config.term === state.term && config.status === "configured").length;
  const progress = visible.filter((sheet) => sheet.status === "draft" || sheet.status === "returned").length;
  const review = visible.filter((sheet) => sheet.status === "submitted").length;
  const published = visible.filter((sheet) => sheet.status === "published").length;

  return (
    <div>
      <PageHeader
        title="Academic records"
        description="Assessment setup, marks entry, and review stay separate from publication."
        actions={
          <div className="flex gap-2">
            <select className={cn(selectClassName(), "w-[9.5rem] shrink-0 pr-8 tabular-nums")} aria-label="Academic year" value={state.year} onChange={(event) => dispatch({ type: "set-period", year: event.target.value, term: state.term })}>
              {state.school.years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
            <select className={cn(selectClassName(), "w-[7.5rem] shrink-0 pr-8")} aria-label="Term" value={state.term} onChange={(event) => dispatch({ type: "set-period", year: state.year, term: event.target.value })}>
              {state.school.terms.map((term) => (
                <option key={term}>{term}</option>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Surface className="p-5">
          <p className="text-[13px] text-muted-foreground">Assessment setup</p>
          <p className="mt-2 text-[26px] font-semibold text-navy">{configured}</p>
          <p className="text-xs text-ink">Configured subjects this term</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-[13px] text-muted-foreground">Marks-entry progress</p>
          <p className="mt-2 text-[26px] font-semibold text-navy">{progress}</p>
          <p className="text-xs text-ink">Draft or returned sheets</p>
        </Surface>
        <Surface className="bg-blue-pale p-5">
          <p className="text-[13px] text-blue">Awaiting review</p>
          <p className="mt-2 text-[26px] font-semibold text-navy">{review}</p>
          <p className="text-xs text-ink">Submitted, not approved</p>
        </Surface>
        <Surface className="bg-success-bg p-5">
          <p className="text-[13px] text-success">Published results</p>
          <p className="mt-2 text-[26px] font-semibold text-success">{published}</p>
          <p className="text-xs text-ink">Released on report cards</p>
        </Surface>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canConfigureAcademics(staff.role) ? <LinkButton href="/academics/assessments">Configure assessments</LinkButton> : null}
        {canEnterMarks(staff.role) ? (
          <LinkButton variant="outline" href="/academics/marks">
            Enter marks
          </LinkButton>
        ) : null}
        {canReviewResults(staff.role) ? (
          <LinkButton variant="outline" href="/academics/review">
            Review results
          </LinkButton>
        ) : null}
      </div>
      <Surface className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">Setup</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Missing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((sheet) => {
                const config = configForSheet(state, sheet)!;
                const missing = sheet.rows.filter((row) => summariseRow(config.components, row.scores, state.school.grading).missing.length > 0).length;
                return (
                  <TableRow key={sheet.id}>
                    <TableCell>{className(state, config.classId)}</TableCell>
                    <TableCell>
                      {subjectName(state, config.subjectId)}
                      <p className="text-xs text-muted-foreground md:hidden">{config.status === "configured" ? "Configured" : "Draft setup"}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge tone={config.status === "configured" ? "success" : "warning"}>
                        {config.status === "configured" ? "Configured" : "Draft setup"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={sheetStatusTone(sheet.status)}>{sheetStatusLabel(sheet.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>{missing === 0 ? "Complete" : `${missing} students`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Surface>
    </div>
  );
}
