"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createInitialState, SESSION_KEY, STATE_KEY } from "@/lib/prototype/data";
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

function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case "hydrate":
      return {
        ...createInitialState(),
        ...action.state,
        school: { ...createInitialState().school, ...action.state.school },
        sessionStaffId: action.state.sessionStaffId ?? null,
      };
    case "sign-in":
      return { ...state, sessionStaffId: action.staffId };
    case "sign-out":
      return { ...state, sessionStaffId: null };
    case "set-period":
      return { ...state, year: action.year, term: action.term };
    case "add-student": {
      const level = state.classes.find((item) => item.id === action.student.classId)?.level;
      const items =
        level === "JHS"
          ? [
              ["Tuition", 110000],
              ["Feeding", 48000],
              ["PTA levy", 10000],
            ]
          : [
              ["Tuition", 85000],
              ["Feeding", 42000],
              ["PTA levy", 8000],
            ];
      const charges = items.map(([label, amount], index) => ({
        id: `${action.student.id}-fee-${index}`,
        studentId: action.student.id,
        year: state.year,
        term: state.term,
        label: String(label),
        amount: Number(amount),
        issuedOn: new Date().toISOString().slice(0, 10),
      }));
      return {
        ...state,
        students: [action.student, ...state.students],
        guardians: [...state.guardians, action.guardian],
        charges: [...state.charges, ...charges],
        sheets: state.sheets.map((sheet) => {
          const config = state.configs.find((item) => item.id === sheet.configId);
          if (!config || config.classId !== action.student.classId || action.student.status !== "enrolled") return sheet;
          return {
            ...sheet,
            rows: [
              ...sheet.rows,
              {
                studentId: action.student.id,
                scores: Object.fromEntries(config.components.map((component) => [component.id, null])),
                remark: null,
              },
            ],
          };
        }),
      };
    }
    case "update-student":
      return {
        ...state,
        students: state.students.map((student) => (student.id === action.student.id ? action.student : student)),
      };
    case "add-guardian":
      return { ...state, guardians: [...state.guardians, action.guardian] };
    case "record-payment":
      return {
        ...state,
        payments: [action.payment, ...state.payments],
        receiptSequence: state.receiptSequence + 1,
      };
    case "save-marks":
      return {
        ...state,
        sheets: state.sheets.map((sheet) =>
          sheet.id === action.sheetId ? { ...sheet, rows: action.rows, status: sheet.status === "published" ? sheet.status : sheet.status === "approved" ? "draft" : sheet.status } : sheet,
        ),
      };
    case "submit-marks":
      return {
        ...state,
        sheets: state.sheets.map((sheet) =>
          sheet.id === action.sheetId ? { ...sheet, status: "submitted", returnReason: null } : sheet,
        ),
      };
    case "return-marks":
      return {
        ...state,
        sheets: state.sheets.map((sheet) =>
          sheet.id === action.sheetId ? { ...sheet, status: "returned", returnReason: action.reason } : sheet,
        ),
      };
    case "approve-marks":
      return {
        ...state,
        sheets: state.sheets.map((sheet) =>
          sheet.id === action.sheetId ? { ...sheet, status: "approved", returnReason: null } : sheet,
        ),
      };
    case "publish-sheet":
      return {
        ...state,
        sheets: state.sheets.map((sheet) =>
          sheet.id === action.sheetId ? { ...sheet, status: "published" } : sheet,
        ),
      };
    case "save-config":
      return {
        ...state,
        configs: state.configs.map((config) =>
          config.id === action.configId ? { ...config, components: action.components, status: action.status } : config,
        ),
      };
    case "add-config": {
      const id = `cfg-${action.classId}-${action.subjectId}-${action.term}`.toLowerCase().replace(/\s+/g, "-");
      const existing = state.configs.find((config) => config.id === id);
      const config = {
        id,
        year: action.year,
        term: action.term,
        classId: action.classId,
        subjectId: action.subjectId,
        components: action.components,
        status: "configured" as const,
      };
      const sheets = existing
        ? state.sheets
        : [
            ...state.sheets,
            {
              id: `sheet-${id}`,
              configId: id,
              status: "draft" as const,
              returnReason: null,
              rows: state.students
                .filter((student) => student.classId === action.classId && student.status === "enrolled")
                .map((student) => ({
                  studentId: student.id,
                  scores: Object.fromEntries(action.components.map((component) => [component.id, null])),
                  remark: null,
                })),
            },
          ];
      return {
        ...state,
        configs: existing ? state.configs.map((item) => (item.id === id ? config : item)) : [...state.configs, config],
        sheets,
      };
    }
    case "upsert-class":
      return {
        ...state,
        classes: state.classes.some((item) => item.id === action.classRoom.id)
          ? state.classes.map((item) => (item.id === action.classRoom.id ? action.classRoom : item))
          : [...state.classes, action.classRoom],
      };
    case "upsert-subject":
      return {
        ...state,
        subjects: state.subjects.some((item) => item.id === action.subject.id)
          ? state.subjects.map((item) => (item.id === action.subject.id ? action.subject : item))
          : [...state.subjects, action.subject],
      };
    case "invite-staff":
      return {
        ...state,
        staff: [
          ...state.staff,
          {
            id: `stf-${Date.now()}`,
            name: action.name,
            email: action.email,
            role: action.role,
            status: "invited",
            classIds: [],
            subjectIds: [],
          },
        ],
      };
    case "update-staff":
      return {
        ...state,
        staff: state.staff.map((member) =>
          member.id === action.staffId
            ? {
                ...member,
                role: action.role,
                classIds: action.classIds,
                subjectIds: action.subjectIds,
                status: action.status,
              }
            : member,
        ),
        classes: state.classes.map((room) => {
          if (action.classIds.includes(room.id)) return { ...room, teacherId: action.staffId };
          if (room.teacherId === action.staffId) return { ...room, teacherId: null };
          return room;
        }),
      };
    case "update-school":
      return { ...state, school: action.school, year: action.school.academicYear, term: action.school.currentTerm };
    case "reset":
      return { ...createInitialState(), sessionStaffId: state.sessionStaffId };
    default:
      return state;
  }
}

type Store = {
  state: PrototypeState;
  ready: boolean;
  dispatch: (action: Action) => void;
};

const PrototypeContext = createContext<Store | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrototypeState>(() => createInitialState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_KEY);
    const savedState = window.localStorage.getItem(STATE_KEY);
    let next = createInitialState();
    if (savedState) {
      try {
        next = reducer(next, { type: "hydrate", state: JSON.parse(savedState) as PrototypeState });
      } catch {
        next = createInitialState();
      }
    }
    if (savedSession) next = { ...next, sessionStaffId: savedSession };
    // Local preview state is read once from this browser after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration from localStorage
    setState(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    if (state.sessionStaffId) window.localStorage.setItem(SESSION_KEY, state.sessionStaffId);
    else window.localStorage.removeItem(SESSION_KEY);
  }, [state, ready]);

  const value = useMemo<Store>(
    () => ({
      state,
      ready,
      dispatch: (action) => setState((current) => reducer(current, action)),
    }),
    [state, ready],
  );

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const store = useContext(PrototypeContext);
  if (!store) throw new Error("usePrototype must be used within PrototypeProvider");
  return store;
}
