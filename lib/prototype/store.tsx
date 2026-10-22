"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { commitAction, signOutAction } from "@/lib/server/actions";
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
        const result = await commitAction(action as { type: string; [key: string]: unknown });
        if (result.error) return result.error;
        router.refresh();
      },
    }),
    [router, state],
  );

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const store = useContext(PrototypeContext);
  if (!store) throw new Error("usePrototype must be used within PrototypeProvider");
  return store;
}
