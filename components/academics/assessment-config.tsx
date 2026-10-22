"use client";

import { useMemo, useState } from "react";
import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canConfigureAcademics } from "@/lib/prototype/permissions";
import { className, currentStaff, subjectName } from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";
import type { AssessmentComponent } from "@/lib/prototype/types";

const starter: AssessmentComponent[] = [
  { id: "cw", name: "Class exercise", max: 20 },
  { id: "hw", name: "Homework", max: 10 },
  { id: "mid", name: "Mid-term", max: 20 },
  { id: "exam", name: "End-of-term exam", max: 50 },
];

export function AssessmentConfigScreen() {
  const { state, dispatch } = usePrototype();
  const staff = currentStaff(state);
  const [classId, setClassId] = useState(state.classes[1]?.id ?? "");
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id ?? "");
  const [saved, setSaved] = useState("");

  const existing = state.configs.find(
    (config) => config.classId === classId && config.subjectId === subjectId && config.year === state.year && config.term === state.term,
  );
  const [components, setComponents] = useState<AssessmentComponent[]>(existing?.components ?? starter);

  const total = components.reduce((sum, item) => sum + Number(item.max || 0), 0);
  const level = state.classes.find((room) => room.id === classId)?.level;
  const subjects = useMemo(
    () => state.subjects.filter((subject) => !level || subject.levels.includes(level)),
    [state.subjects, level],
  );

  if (!staff || !canConfigureAcademics(staff.role)) {
    return <Surface className="p-8 text-sm">Only a school administrator can configure assessments.</Surface>;
  }

  function load(nextClass: string, nextSubject: string) {
    const match = state.configs.find(
      (config) => config.classId === nextClass && config.subjectId === nextSubject && config.year === state.year && config.term === state.term,
    );
    setComponents(match?.components.map((item) => ({ ...item })) ?? starter.map((item) => ({ ...item })));
    setSaved("");
  }

  const previewScore = Math.min(16, components[0]?.max ?? 0);

  return (
    <div>
      <PageHeader
        title="Assessment configuration"
        description={`${state.term}, ${state.year}. Component maxima add up to the subject total. Missing marks are never treated as zero.`}
      />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Surface className="space-y-3 p-5">
          <label className="block space-y-1.5 text-sm">
            Academic year
            <select className={selectClassName()} value={state.year} onChange={(event) => dispatch({ type: "set-period", year: event.target.value, term: state.term })}>
              {state.school.years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            Term
            <select className={selectClassName()} value={state.term} onChange={(event) => dispatch({ type: "set-period", year: state.year, term: event.target.value })}>
              {state.school.terms.map((term) => (
                <option key={term}>{term}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            Class
            <select
              className={selectClassName()}
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                load(event.target.value, subjectId);
              }}
            >
              {state.classes.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            Subject
            <select
              className={selectClassName()}
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                load(classId, event.target.value);
              }}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </Surface>
        <Surface className="p-5">
          <h2 className="text-lg font-semibold text-navy">
            {className(state, classId)} · {subjectName(state, subjectId)}
          </h2>
          <div className="mt-4 space-y-3">
            {components.map((component, index) => (
              <div key={component.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Input
                  aria-label={`Component ${index + 1} name`}
                  value={component.name}
                  onChange={(event) =>
                    setComponents((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))
                  }
                />
                <Input
                  aria-label={`${component.name} maximum`}
                  inputMode="numeric"
                  value={component.max}
                  onChange={(event) =>
                    setComponents((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, max: Number(event.target.value) } : item)),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <p className={`mt-4 text-sm ${total === 100 ? "text-success" : "text-warning"}`}>
            Combined maximum is {total}. {total === 100 ? "The subject total is 100." : "The school scale expects a total of 100."}
          </p>
          <div className="mt-4 rounded-xl bg-blue-pale p-4 text-sm">
            <p className="font-medium text-navy">Calculation preview</p>
            <p className="mt-1 text-ink">
              A score of {previewScore} on {components[0]?.name ?? "the first component"} contributes {previewScore} points. The grade is assigned only when every component has a mark.
            </p>
            <ul className="mt-3 space-y-1 text-muted-foreground">
              {state.school.grading.map((band) => (
                <li key={band.grade}>
                  {band.grade} · {band.label} · from {band.min}
                </li>
              ))}
            </ul>
          </div>
          {saved ? <p className="mt-3 text-sm text-success">{saved}</p> : null}
          <Button
            className="mt-4"
            type="button"
            onClick={() => {
              if (components.some((item) => !item.name.trim() || item.max <= 0)) {
                setSaved("");
                return;
              }
              if (existing) {
                dispatch({ type: "save-config", configId: existing.id, components, status: "configured" });
              } else {
                dispatch({ type: "add-config", year: state.year, term: state.term, classId, subjectId, components });
              }
              setSaved("Assessment saved.");
            }}
          >
            Save assessment
          </Button>
        </Surface>
      </div>
    </div>
  );
}
