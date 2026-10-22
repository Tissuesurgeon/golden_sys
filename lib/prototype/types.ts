export type Role = "administrator" | "bursar" | "teacher";

export type StudentStatus = "enrolled" | "withdrawn" | "graduated" | "pending" | "transferred";

export type PaymentMethod = "Cash" | "Mobile Money" | "Bank Transfer" | "Other";

export type SheetStatus = "draft" | "submitted" | "returned" | "approved" | "published";

export type Student = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames: string;
  sex: "Female" | "Male";
  dateOfBirth: string;
  classId: string;
  status: StudentStatus;
  enrolledOn: string;
  residentialAddress: string;
};

export type Guardian = {
  id: string;
  studentId: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
  occupation: string;
  primary: boolean;
};

export type ClassRoom = {
  id: string;
  name: string;
  level: "KG" | "Primary" | "JHS";
  teacherId: string | null;
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  levels: Array<ClassRoom["level"]>;
};

export type Staff = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited";
  classIds: string[];
  subjectIds: string[];
};

export type Charge = {
  id: string;
  studentId: string;
  year: string;
  term: string;
  label: string;
  amount: number;
  issuedOn: string;
};

export type Adjustment = {
  id: string;
  studentId: string;
  year: string;
  term: string;
  label: string;
  amount: number;
  date: string;
};

export type Allocation = {
  chargeId: string;
  amount: number;
};

export type Payment = {
  id: string;
  receiptNumber: string;
  studentId: string;
  date: string;
  method: PaymentMethod;
  reference: string;
  amount: number;
  allocations: Allocation[];
  recordedBy: string;
  sample: boolean;
};

export type GradeBand = {
  min: number;
  grade: string;
  label: string;
};

export type SchoolSettings = {
  name: string;
  motto: string;
  town: string;
  region: string;
  country: string;
  address: string;
  phone: string;
  email: string;
  academicYear: string;
  currentTerm: string;
  years: string[];
  terms: string[];
  grading: GradeBand[];
  enrollmentPolicy?: "full_or_waiver" | "minimum_deposit" | "waiver_only";
  minimumDeposit?: number;
  admissionFee?: number;
};

export type AssessmentComponent = {
  id: string;
  name: string;
  max: number;
};

export type AssessmentConfig = {
  id: string;
  year: string;
  term: string;
  classId: string;
  subjectId: string;
  components: AssessmentComponent[];
  status: "draft" | "configured";
};

export type MarkRow = {
  studentId: string;
  scores: Record<string, number | null>;
  remark: string | null;
};

export type MarkSheet = {
  id: string;
  configId: string;
  status: SheetStatus;
  returnReason: string | null;
  rows: MarkRow[];
};

export type PrototypeState = {
  sessionStaffId: string | null;
  year: string;
  term: string;
  students: Student[];
  guardians: Guardian[];
  classes: ClassRoom[];
  subjects: Subject[];
  staff: Staff[];
  charges: Charge[];
  adjustments: Adjustment[];
  payments: Payment[];
  school: SchoolSettings;
  configs: AssessmentConfig[];
  sheets: MarkSheet[];
  receiptSequence: number;
};
