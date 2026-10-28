"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/lib/server/actions";
import {
  addConfig,
  addGuardian,
  addStudent,
  approveMarks,
  inviteStaff,
  publishSheet,
  recordPayment,
  returnMarks,
  saveConfig,
  saveMarks,
  submitMarks,
  updateSchool,
  updateStaff,
  updateStudent,
  upsertClass,
  upsertSubject,
} from "@/lib/server/office-actions";
import type {
  AssessmentComponent,
  ClassRoom,
  Guardian,
  MarkRow,
  Payment,
  PrototypeState,
  Role,
  SchoolSettings,
  Student,
  Subject,
} from "@/lib/prototype/types";

type Action =
  | { type: "hydrate"; state: PrototypeState }
  | { type: "sign-in"; staffId: string }
  | { type: "sign-out" }
  | { type: "set-period"; year: string; term: string }
  | { type: "add-student"; student: Student; guardian: Guardian }
  | { type: "update-student"; student: Student }
  | { type: "add-guardian"; guardian: Guardian }
  | { type: "record-payment"; payment: Payment }
  | { type: "save-marks"; sheetId: string; rows: MarkRow[] }
  | { type: "submit-marks"; sheetId: string }
  | { type: "return-marks"; sheetId: string; reason: string }
  | { type: "approve-marks"; sheetId: string }
  | { type: "publish-sheet"; sheetId: string }
  | { type: "save-config"; configId: string; components: AssessmentComponent[]; status: "draft" | "configured" }
  | { type: "add-config"; year: string; term: string; classId: string; subjectId: string; components: AssessmentComponent[] }
  | { type: "upsert-class"; classRoom: ClassRoom }
  | { type: "upsert-subject"; subject: Subject }
  | { type: "invite-staff"; name: string; email: string; role: Role }
  | { type: "update-staff"; staffId: string; role: Role; classIds: string[]; subjectIds: string[]; status: "active" | "invited" }
  | { type: "update-school"; school: SchoolSettings }
  | { type: "reset" };


type Store = {
  state: PrototypeState;
  ready: boolean;
  dispatch: (action: Action) => Promise<string | void>;
};

const PrototypeContext = createContext<Store | null>(null);

export function PrototypeProvider({ initial, children }: { initial: PrototypeState; children: ReactNode }) {
  const router = useRouter();
  const [period, setPeriod] = useState({ year: initial.year, term: initial.term });
  const state = useMemo(() => ({ ...initial, year: period.year, term: period.term }), [initial, period]);

  const value = useMemo<Store>(
    () => ({
      state,
      ready: true,
      dispatch: async (action) => {
        if (action.type === "set-period") {
          setPeriod({ year: action.year, term: action.term });
          return;
        }
        if (action.type === "sign-out") {
          await signOutAction();
          return;
        }
        if (action.type === "sign-in" || action.type === "hydrate" || action.type === "reset") return;
        const result = await callOffice(action);
        if (result.error) return result.error;
        router.refresh();
      },
    }),
    [router, state],
  );

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

async function callOffice(action: Exclude<Action, { type: "hydrate" | "sign-in" | "sign-out" | "set-period" | "reset" }>) {
  switch (action.type) {
    case "add-student":
      return addStudent(action);
    case "update-student":
      return updateStudent(action.student);
    case "add-guardian":
      return addGuardian(action.guardian);
    case "record-payment":
      return recordPayment(action.payment);
    case "save-marks":
      return saveMarks(action.sheetId, action.rows);
    case "submit-marks":
      return submitMarks(action.sheetId);
    case "return-marks":
      return returnMarks(action.sheetId, action.reason);
    case "approve-marks":
      return approveMarks(action.sheetId);
    case "publish-sheet":
      return publishSheet(action.sheetId);
    case "save-config":
      return saveConfig(action.configId, action.components, action.status);
    case "add-config":
      return addConfig(action);
    case "upsert-class":
      return upsertClass(action.classRoom);
    case "upsert-subject":
      return upsertSubject(action.subject);
    case "invite-staff":
      return inviteStaff(action);
    case "update-staff":
      return updateStaff(action);
    case "update-school":
      return updateSchool(action.school);
    default:
      throw new Error("Unknown operation.");
  }
}

export function usePrototype() {
  const store = useContext(PrototypeContext);
  if (!store) throw new Error("usePrototype must be used within PrototypeProvider");
  return store;
}
