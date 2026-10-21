import type {
  Adjustment,
  AssessmentConfig,
  Charge,
  ClassRoom,
  Guardian,
  MarkSheet,
  Payment,
  PrototypeState,
  SchoolSettings,
  Staff,
  Student,
  Subject,
} from "@/lib/prototype/types";

const COMPONENTS = [
  { id: "cw", name: "Class exercise", max: 20 },
  { id: "hw", name: "Homework", max: 10 },
  { id: "mid", name: "Mid-term", max: 20 },
  { id: "exam", name: "End-of-term exam", max: 50 },
];

export const PREVIEW_PASSWORD = "knowledge";

export const schoolSeed = (): SchoolSettings => ({
  name: "Golden Child School",
  motto: "KNOWLEDGE IS POWER",
  town: "Koforidua",
  region: "Eastern Region",
  country: "Ghana",
  address: "P.O. Box KN 214, Koforidua",
  phone: "+233 34 000 2140",
  email: "office@goldenchild.example",
  academicYear: "2025/2026",
  currentTerm: "Term 1",
  years: ["2025/2026", "2024/2025"],
  terms: ["Term 1", "Term 2", "Term 3"],
  grading: [
    { min: 80, grade: "A", label: "Excellent" },
    { min: 70, grade: "B", label: "Very good" },
    { min: 60, grade: "C", label: "Good" },
    { min: 50, grade: "D", label: "Credit" },
    { min: 40, grade: "E", label: "Pass" },
    { min: 0, grade: "F", label: "Fail" },
  ],
});

const classes: ClassRoom[] = [
  { id: "cls-kg1", name: "KG 1", level: "KG", teacherId: null },
  { id: "cls-b4", name: "Basic 4", level: "Primary", teacherId: "stf-efua" },
  { id: "cls-b5", name: "Basic 5", level: "Primary", teacherId: null },
  { id: "cls-b6", name: "Basic 6", level: "Primary", teacherId: "stf-akosua" },
  { id: "cls-j1", name: "JHS 1", level: "JHS", teacherId: "stf-yaw" },
  { id: "cls-j2", name: "JHS 2", level: "JHS", teacherId: null },
];

const subjects: Subject[] = [
  { id: "sub-eng", name: "English Language", code: "ENG", levels: ["Primary", "JHS"] },
  { id: "sub-math", name: "Mathematics", code: "MATH", levels: ["Primary", "JHS"] },
  { id: "sub-sci", name: "Integrated Science", code: "SCI", levels: ["JHS"] },
  { id: "sub-twi", name: "Ghanaian Language", code: "GHL", levels: ["Primary", "JHS"] },
  { id: "sub-art", name: "Creative Arts", code: "ART", levels: ["Primary"] },
  { id: "sub-comp", name: "Computing", code: "COMP", levels: ["Primary", "JHS"] },
  { id: "sub-rme", name: "Religious and Moral Education", code: "RME", levels: ["Primary", "JHS"] },
  { id: "sub-owop", name: "Our World Our People", code: "OWOP", levels: ["Primary"] },
  { id: "sub-soc", name: "Social Studies", code: "SOC", levels: ["JHS"] },
  { id: "sub-career", name: "Career Technology", code: "CT", levels: ["JHS"] },
  { id: "sub-fre", name: "French", code: "FRE", levels: ["JHS"] },
];

const staff: Staff[] = [
  {
    id: "stf-ama",
    name: "Ama Serwaa Mensah",
    email: "ama.mensah@goldenchild.example",
    role: "administrator",
    status: "active",
    classIds: [],
    subjectIds: [],
  },
  {
    id: "stf-kwame",
    name: "Kwame Boateng",
    email: "kwame.boateng@goldenchild.example",
    role: "bursar",
    status: "active",
    classIds: [],
    subjectIds: [],
  },
  {
    id: "stf-efua",
    name: "Efua Asante",
    email: "efua.asante@goldenchild.example",
    role: "teacher",
    status: "active",
    classIds: ["cls-b4"],
    subjectIds: ["sub-eng", "sub-math"],
  },
  {
    id: "stf-yaw",
    name: "Yaw Darko",
    email: "yaw.darko@goldenchild.example",
    role: "teacher",
    status: "active",
    classIds: ["cls-j1"],
    subjectIds: ["sub-sci", "sub-math"],
  },
  {
    id: "stf-akosua",
    name: "Akosua Frimpong",
    email: "akosua.frimpong@goldenchild.example",
    role: "teacher",
    status: "active",
    classIds: ["cls-b6"],
    subjectIds: ["sub-eng", "sub-art"],
  },
  {
    id: "stf-abena",
    name: "Abena Owusu",
    email: "abena.owusu@goldenchild.example",
    role: "teacher",
    status: "invited",
    classIds: ["cls-j2"],
    subjectIds: ["sub-soc"],
  },
];

type Seed = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  sex: Student["sex"];
  dateOfBirth: string;
  classId: string;
  status: Student["status"];
  enrolledOn: string;
  address: string;
  pay: "full" | "tuition" | "none";
  payDate?: string;
  method?: Payment["method"];
  prior?: number;
  guardian: Omit<Guardian, "id" | "studentId" | "primary">;
  secondGuardian?: Omit<Guardian, "id" | "studentId" | "primary">;
};

const seeds: Seed[] = [
  {
    id: "stu-adwoa",
    admissionNumber: "GCS-2023-014",
    firstName: "Adwoa",
    lastName: "Nyarko",
    sex: "Female",
    dateOfBirth: "2015-03-12",
    classId: "cls-b4",
    status: "enrolled",
    enrolledOn: "2023-09-11",
    address: "Adweso, Koforidua",
    pay: "full",
    payDate: "2026-09-10",
    method: "Mobile Money",
    guardian: { fullName: "Akosua Nyarko", relationship: "Mother", phone: "024 411 2201", email: "akosua.nyarko@example.com", occupation: "Trader" },
    secondGuardian: { fullName: "Kwabena Nyarko", relationship: "Father", phone: "020 188 3340", email: "", occupation: "Driver" },
  },
  {
    id: "stu-kwesi",
    admissionNumber: "GCS-2023-021",
    firstName: "Kwesi",
    lastName: "Annan",
    sex: "Male",
    dateOfBirth: "2015-07-02",
    classId: "cls-b4",
    status: "enrolled",
    enrolledOn: "2023-09-11",
    address: "Two Streams, Koforidua",
    pay: "tuition",
    payDate: "2026-10-06",
    method: "Cash",
    prior: 15000,
    guardian: { fullName: "Esi Annan", relationship: "Mother", phone: "055 302 1188", email: "esi.annan@example.com", occupation: "Seamstress" },
  },
  {
    id: "stu-maame",
    admissionNumber: "GCS-2022-088",
    firstName: "Maame",
    lastName: "Boateng",
    otherNames: "Esi",
    sex: "Female",
    dateOfBirth: "2014-11-19",
    classId: "cls-b4",
    status: "enrolled",
    enrolledOn: "2022-09-12",
    address: "Old Estate, Koforidua",
    pay: "full",
    payDate: "2026-09-18",
    method: "Bank Transfer",
    guardian: { fullName: "Yaa Boateng", relationship: "Aunt", phone: "024 900 4412", email: "yaa.boateng@example.com", occupation: "Nurse" },
  },
  {
    id: "stu-kofi",
    admissionNumber: "GCS-2023-033",
    firstName: "Kofi",
    lastName: "Adu",
    sex: "Male",
    dateOfBirth: "2015-01-28",
    classId: "cls-b4",
    status: "withdrawn",
    enrolledOn: "2023-09-11",
    address: "Asokore, Koforidua",
    pay: "tuition",
    payDate: "2026-09-12",
    method: "Cash",
    guardian: { fullName: "Ama Adu", relationship: "Mother", phone: "027 155 0091", email: "", occupation: "Caterer" },
  },
  {
    id: "stu-akua",
    admissionNumber: "GCS-2024-007",
    firstName: "Akua",
    lastName: "Sarpong",
    sex: "Female",
    dateOfBirth: "2015-09-04",
    classId: "cls-b4",
    status: "enrolled",
    enrolledOn: "2024-09-09",
    address: "Srodae, Koforidua",
    pay: "none",
    guardian: { fullName: "Kwame Sarpong", relationship: "Father", phone: "050 221 7783", email: "kwame.sarpong@example.com", occupation: "Mechanic" },
  },
  {
    id: "stu-yawm",
    admissionNumber: "GCS-2023-041",
    firstName: "Yaw",
    lastName: "Mensah",
    sex: "Male",
    dateOfBirth: "2015-05-16",
    classId: "cls-b4",
    status: "enrolled",
    enrolledOn: "2023-09-11",
    address: "Nyakrom, Koforidua",
    pay: "none",
    guardian: { fullName: "Afia Mensah", relationship: "Mother", phone: "024 333 9088", email: "", occupation: "Hairdresser" },
  },
  {
    id: "stu-abena-d",
    admissionNumber: "GCS-2021-012",
    firstName: "Abena",
    lastName: "Darko",
    sex: "Female",
    dateOfBirth: "2013-02-08",
    classId: "cls-b6",
    status: "enrolled",
    enrolledOn: "2021-09-13",
    address: "Ada, Koforidua",
    pay: "full",
    payDate: "2026-10-02",
    method: "Mobile Money",
    guardian: { fullName: "Stephen Darko", relationship: "Father", phone: "020 445 6610", email: "stephen.darko@example.com", occupation: "Teacher" },
  },
  {
    id: "stu-kojo",
    admissionNumber: "GCS-2021-019",
    firstName: "Kojo",
    lastName: "Owusu",
    sex: "Male",
    dateOfBirth: "2013-08-23",
    classId: "cls-b6",
    status: "enrolled",
    enrolledOn: "2021-09-13",
    address: "Betom, Koforidua",
    pay: "tuition",
    payDate: "2026-10-14",
    method: "Mobile Money",
    guardian: { fullName: "Mary Owusu", relationship: "Mother", phone: "054 778 2204", email: "mary.owusu@example.com", occupation: "Shop keeper" },
  },
  {
    id: "stu-efua-a",
    admissionNumber: "GCS-2020-044",
    firstName: "Efua",
    lastName: "Ampofo",
    sex: "Female",
    dateOfBirth: "2013-12-01",
    classId: "cls-b6",
    status: "enrolled",
    enrolledOn: "2020-09-14",
    address: "Korele, Koforidua",
    pay: "none",
    guardian: { fullName: "Joseph Ampofo", relationship: "Uncle", phone: "024 616 3002", email: "", occupation: "Farmer" },
  },
  {
    id: "stu-nana",
    admissionNumber: "GCS-2021-028",
    firstName: "Nana Yaa",
    lastName: "Asare",
    sex: "Female",
    dateOfBirth: "2013-04-30",
    classId: "cls-b6",
    status: "enrolled",
    enrolledOn: "2021-09-13",
    address: "Okorase Road, Koforidua",
    pay: "none",
    guardian: { fullName: "Comfort Asare", relationship: "Mother", phone: "059 100 4428", email: "comfort.asare@example.com", occupation: "Secretary" },
  },
  {
    id: "stu-michael",
    admissionNumber: "GCS-2019-006",
    firstName: "Michael",
    lastName: "Tetteh",
    sex: "Male",
    dateOfBirth: "2011-06-14",
    classId: "cls-j1",
    status: "enrolled",
    enrolledOn: "2019-09-09",
    address: "Mile 50, Koforidua",
    pay: "tuition",
    payDate: "2026-09-22",
    method: "Bank Transfer",
    guardian: { fullName: "Grace Tetteh", relationship: "Mother", phone: "024 200 1184", email: "grace.tetteh@example.com", occupation: "Banker" },
  },
  {
    id: "stu-priscilla",
    admissionNumber: "GCS-2019-011",
    firstName: "Priscilla",
    lastName: "Osei",
    sex: "Female",
    dateOfBirth: "2011-10-09",
    classId: "cls-j1",
    status: "enrolled",
    enrolledOn: "2019-09-09",
    address: "Trom, Koforidua",
    pay: "full",
    payDate: "2026-10-09",
    method: "Cash",
    guardian: { fullName: "Samuel Osei", relationship: "Father", phone: "020 333 7711", email: "samuel.osei@example.com", occupation: "Pastor" },
  },
  {
    id: "stu-daniel",
    admissionNumber: "GCS-2019-018",
    firstName: "Daniel",
    lastName: "Quaye",
    sex: "Male",
    dateOfBirth: "2011-01-21",
    classId: "cls-j1",
    status: "enrolled",
    enrolledOn: "2019-09-09",
    address: "Nsukwao, Koforidua",
    pay: "none",
    guardian: { fullName: "Linda Quaye", relationship: "Mother", phone: "055 909 3344", email: "", occupation: "Trader" },
  },
  {
    id: "stu-linda",
    admissionNumber: "GCS-2020-003",
    firstName: "Linda",
    lastName: "Frimpong",
    sex: "Female",
    dateOfBirth: "2012-03-03",
    classId: "cls-j1",
    status: "enrolled",
    enrolledOn: "2020-09-14",
    address: "Anlo Town, Koforidua",
    pay: "none",
    guardian: { fullName: "Peter Frimpong", relationship: "Father", phone: "024 777 6501", email: "peter.frimpong@example.com", occupation: "Carpenter" },
  },
  {
    id: "stu-samuel",
    admissionNumber: "GCS-2019-022",
    firstName: "Samuel",
    lastName: "Addo",
    sex: "Male",
    dateOfBirth: "2011-12-17",
    classId: "cls-j1",
    status: "enrolled",
    enrolledOn: "2019-09-09",
    address: "Oyoko, Koforidua",
    pay: "none",
    guardian: { fullName: "Beatrice Addo", relationship: "Mother", phone: "050 612 8800", email: "", occupation: "Cook" },
  },
  {
    id: "stu-grace",
    admissionNumber: "GCS-2018-009",
    firstName: "Grace",
    lastName: "Mensima",
    sex: "Female",
    dateOfBirth: "2010-08-11",
    classId: "cls-j2",
    status: "enrolled",
    enrolledOn: "2018-09-10",
    address: "Jumapo Road, Koforidua",
    pay: "full",
    payDate: "2026-10-16",
    method: "Mobile Money",
    guardian: { fullName: "Eric Mensima", relationship: "Father", phone: "024 515 0099", email: "eric.mensima@example.com", occupation: "Civil servant" },
  },
  {
    id: "stu-isaac",
    admissionNumber: "GCS-2018-014",
    firstName: "Isaac",
    lastName: "Boateng",
    sex: "Male",
    dateOfBirth: "2010-05-27",
    classId: "cls-j2",
    status: "enrolled",
    enrolledOn: "2018-09-10",
    address: "Densuano, Koforidua",
    pay: "tuition",
    payDate: "2026-09-15",
    method: "Cash",
    guardian: { fullName: "Hannah Boateng", relationship: "Mother", phone: "027 404 2218", email: "hannah.boateng@example.com", occupation: "Pharmacist" },
  },
  {
    id: "stu-ruth",
    admissionNumber: "GCS-2018-021",
    firstName: "Ruth",
    lastName: "Adjei",
    sex: "Female",
    dateOfBirth: "2010-11-06",
    classId: "cls-j2",
    status: "enrolled",
    enrolledOn: "2018-09-10",
    address: "Effiduase, Koforidua",
    pay: "none",
    prior: 20000,
    guardian: { fullName: "John Adjei", relationship: "Father", phone: "020 818 4455", email: "", occupation: "Mason" },
    secondGuardian: { fullName: "Mary Adjei", relationship: "Mother", phone: "024 818 4456", email: "mary.adjei@example.com", occupation: "Trader" },
  },
];

function feeItems(level: ClassRoom["level"]) {
  if (level === "JHS") {
    return [
      ["Tuition", 110000],
      ["Feeding", 48000],
      ["PTA levy", 10000],
    ] as const;
  }
  return [
    ["Tuition", 85000],
    ["Feeding", 42000],
    ["PTA levy", 8000],
  ] as const;
}

function buildFinance(studentSeeds: Seed[], classList: ClassRoom[]) {
  const charges: Charge[] = [];
  const payments: Payment[] = [];
  const adjustments: Adjustment[] = [];
  let receipt = 140;

  for (const seed of studentSeeds) {
    const level = classList.find((item) => item.id === seed.classId)?.level ?? "Primary";
    if (seed.prior) {
      charges.push({
        id: `${seed.id}-prior`,
        studentId: seed.id,
        year: "2024/2025",
        term: "Term 3",
        label: "Balance brought forward",
        amount: seed.prior,
        issuedOn: "2025-07-18",
      });
    }
    const current = feeItems(level).map(([label, amount], index) => ({
      id: `${seed.id}-t1-${index}`,
      studentId: seed.id,
      year: "2025/2026",
      term: "Term 1",
      label,
      amount,
      issuedOn: "2026-09-08",
    }));
    charges.push(...current);

    if (seed.pay === "none") continue;
    const selected = seed.pay === "full" ? current : current.filter((item) => item.label === "Tuition");
    receipt += 1;
    payments.push({
      id: `pay-${receipt}`,
      receiptNumber: `GCS-2026-${receipt}`,
      studentId: seed.id,
      date: seed.payDate ?? "2026-10-01",
      method: seed.method ?? "Cash",
      reference: seed.method === "Cash" ? "" : `MM-${receipt}`,
      amount: selected.reduce((sum, item) => sum + item.amount, 0),
      allocations: selected.map((item) => ({ chargeId: item.id, amount: item.amount })),
      recordedBy: "stf-kwame",
      sample: true,
    });
  }

  adjustments.push({
    id: "adj-maame-pta",
    studentId: "stu-maame",
    year: "2025/2026",
    term: "Term 1",
    label: "PTA levy waiver",
    amount: -5000,
    date: "2026-09-16",
  });

  return { charges, payments, adjustments, receiptSequence: receipt };
}

function scores(values: Array<number | null>): Record<string, number | null> {
  return { cw: values[0], hw: values[1], mid: values[2], exam: values[3] };
}

function sheetRows(
  studentIds: string[],
  values: Record<string, Array<number | null>>,
  remarks: Record<string, string | null> = {},
) {
  return studentIds
    .filter((id) => id !== "stu-kofi")
    .map((studentId) => ({
      studentId,
      scores: scores(values[studentId] ?? [null, null, null, null]),
      remark: remarks[studentId] ?? null,
    }));
}

const b4 = ["stu-adwoa", "stu-kwesi", "stu-maame", "stu-kofi", "stu-akua", "stu-yawm"];
const b6 = ["stu-abena-d", "stu-kojo", "stu-efua-a", "stu-nana"];
const j1 = ["stu-michael", "stu-priscilla", "stu-daniel", "stu-linda", "stu-samuel"];

const configs: AssessmentConfig[] = [
  {
    id: "cfg-b4-eng",
    year: "2025/2026",
    term: "Term 1",
    classId: "cls-b4",
    subjectId: "sub-eng",
    components: COMPONENTS,
    status: "configured",
  },
  {
    id: "cfg-b4-math",
    year: "2025/2026",
    term: "Term 1",
    classId: "cls-b4",
    subjectId: "sub-math",
    components: COMPONENTS,
    status: "configured",
  },
  {
    id: "cfg-b6-eng",
    year: "2025/2026",
    term: "Term 1",
    classId: "cls-b6",
    subjectId: "sub-eng",
    components: COMPONENTS,
    status: "configured",
  },
  {
    id: "cfg-j1-sci",
    year: "2025/2026",
    term: "Term 1",
    classId: "cls-j1",
    subjectId: "sub-sci",
    components: COMPONENTS,
    status: "configured",
  },
  {
    id: "cfg-j1-math",
    year: "2025/2026",
    term: "Term 1",
    classId: "cls-j1",
    subjectId: "sub-math",
    components: COMPONENTS.map((item) => ({ ...item })),
    status: "draft",
  },
];

const sheets: MarkSheet[] = [
  {
    id: "sheet-b4-eng",
    configId: "cfg-b4-eng",
    status: "submitted",
    returnReason: null,
    rows: sheetRows(b4, {
      "stu-adwoa": [16, 8, 15, 41],
      "stu-kwesi": [14, 7, 12, null],
      "stu-maame": [18, 9, 17, 44],
      "stu-akua": [10, 5, 9, 22],
      "stu-yawm": [12, null, 11, 30],
    }),
  },
  {
    id: "sheet-b4-math",
    configId: "cfg-b4-math",
    status: "draft",
    returnReason: null,
    rows: sheetRows(b4, {
      "stu-adwoa": [15, 8, 14, null],
      "stu-kwesi": [11, 6, null, null],
      "stu-maame": [17, 9, 16, 40],
      "stu-akua": [null, null, null, null],
      "stu-yawm": [9, 4, 8, null],
    }),
  },
  {
    id: "sheet-b6-eng",
    configId: "cfg-b6-eng",
    status: "published",
    returnReason: null,
    rows: sheetRows(
      b6,
      {
        "stu-abena-d": [18, 9, 16, 42],
        "stu-kojo": [14, 7, 13, 33],
        "stu-efua-a": [12, 6, 11, 28],
        "stu-nana": [17, 8, 15, 39],
      },
      {
        "stu-abena-d": "Abena reads fluently and explains her answers clearly.",
        "stu-kojo": "Kojo participates well. He should finish written work with more care.",
        "stu-efua-a": "Efua is steady in class. Extra reading at home will help her exam score.",
        "stu-nana": "Nana Yaa writes neatly and keeps up with the class exercises.",
      },
    ),
  },
  {
    id: "sheet-j1-sci",
    configId: "cfg-j1-sci",
    status: "approved",
    returnReason: null,
    rows: sheetRows(j1, {
      "stu-michael": [15, 8, 14, 36],
      "stu-priscilla": [18, 10, 18, 46],
      "stu-daniel": [11, 5, 10, 24],
      "stu-linda": [16, 8, 15, 38],
      "stu-samuel": [13, 6, 12, 30],
    }),
  },
];

export function createInitialState(): PrototypeState {
  const students: Student[] = seeds.map((seed) => ({
    id: seed.id,
    admissionNumber: seed.admissionNumber,
    firstName: seed.firstName,
    lastName: seed.lastName,
    otherNames: seed.otherNames ?? "",
    sex: seed.sex,
    dateOfBirth: seed.dateOfBirth,
    classId: seed.classId,
    status: seed.status,
    enrolledOn: seed.enrolledOn,
    residentialAddress: seed.address,
  }));

  const guardians: Guardian[] = seeds.flatMap((seed) => {
    const primary: Guardian = {
      id: `${seed.id}-g1`,
      studentId: seed.id,
      primary: true,
      ...seed.guardian,
    };
    if (!seed.secondGuardian) return [primary];
    return [
      primary,
      { id: `${seed.id}-g2`, studentId: seed.id, primary: false, ...seed.secondGuardian },
    ];
  });

  const finance = buildFinance(seeds, classes);

  return {
    sessionStaffId: null,
    year: "2025/2026",
    term: "Term 1",
    students,
    guardians,
    classes,
    subjects,
    staff,
    charges: finance.charges,
    adjustments: finance.adjustments,
    payments: finance.payments,
    school: schoolSeed(),
    configs,
    sheets,
    receiptSequence: finance.receiptSequence,
  };
}

export const SESSION_KEY = "gcs-preview-session";
export const STATE_KEY = "gcs-preview-state";
