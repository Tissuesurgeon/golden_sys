"use client";

import Link from "next/link";
import { useState } from "react";
import { StudentForm, toStudent, type StudentFormValues } from "@/components/students/student-form";
import {
  LinkButton,
  PageHeader,
  SectionTitle,
  StatusBadge,
  Surface,
  balanceLabel,
  balanceTone,
  sheetStatusLabel,
  sheetStatusTone,
  studentStatusTone,
} from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, initials } from "@/lib/format";
import { canViewFinance } from "@/lib/prototype/permissions";
import {
  buildStatement,
  chargeBalance,
  className,
  configForSheet,
  currentStaff,
  studentName,
  studentOutstanding,
  subjectName,
  summariseRow,
} from "@/lib/prototype/selectors";
import { usePrototype } from "@/lib/prototype/store";

export function StudentProfile({ studentId }: { studentId: string }) {
  const { state, dispatch } = usePrototype();
  const student = state.students.find((item) => item.id === studentId);
  const staff = currentStaff(state);
  const finance = canViewFinance(staff?.role ?? "teacher");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [relationship, setRelationship] = useState("Guardian");
  const [guardianError, setGuardianError] = useState("");

  if (!student) {
    return (
      <Surface className="p-8">
        <h1 className="text-xl font-semibold text-navy">Student not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">That admission was not found.</p>
        <LinkButton href="/students" className="mt-4">
          Back to students
        </LinkButton>
      </Surface>
    );
  }

  const guardians = state.guardians.filter((item) => item.studentId === student.id);
  const balance = studentOutstanding(state, student.id, state.year, state.term);
  const statement = buildStatement(state, student.id, state.year, state.term);
  const charges = state.charges.filter(
    (item) => item.studentId === student.id && item.year === state.year && item.term === state.term,
  );
  const payments = state.payments.filter((item) => item.studentId === student.id);
  const academic = state.sheets
    .map((sheet) => ({ sheet, config: configForSheet(state, sheet) }))
    .filter((item) => item.config?.classId === student.classId && item.config.year === state.year && item.config.term === state.term);

  return (
    <div>
      <PageHeader title="Student profile" description="Fees and academic records stay attached to this admission." />
      <Surface className="mb-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-16 place-items-center rounded-full bg-navy text-lg font-semibold text-white">
            {initials(studentName(student))}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-semibold text-navy">{studentName(student)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.admissionNumber} · {className(state, student.classId)}
            </p>
          </div>
          <StatusBadge tone={studentStatusTone(student.status)}>
            {student.status[0].toUpperCase() + student.status.slice(1)}
          </StatusBadge>
        </div>
      </Surface>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {["overview", "fees", "academics", "guardian", "details"]
            .filter((tab) => finance || tab !== "fees")
            .map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab === "details" ? "Student details" : tab}
              </TabsTrigger>
            ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Surface className="p-5">
              <SectionTitle title="Student" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Fact label="Sex" value={student.sex} />
                <Fact label="Date of birth" value={formatDate(student.dateOfBirth)} />
                <Fact label="Enrolled" value={formatDate(student.enrolledOn)} />
                <Fact label="Address" value={student.residentialAddress} />
              </dl>
            </Surface>
            <Surface className="p-5">
              <SectionTitle title="Primary guardian" />
              {guardians[0] ? (
                <dl className="grid gap-2 text-sm">
                  <Fact label="Name" value={guardians[0].fullName} />
                  <Fact label="Relationship" value={guardians[0].relationship} />
                  <Fact label="Phone" value={guardians[0].phone} />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No guardian has been added.</p>
              )}
            </Surface>
            {finance ? (
              <Surface className="p-5">
                <SectionTitle title="Fees this term" action={<Link className="text-sm font-medium text-blue" href={`/fees/statements/${student.id}`}>Statement</Link>} />
                <p className="text-[28px] font-semibold text-navy">{formatMoney(balance)}</p>
                <div className="mt-2">
                  <StatusBadge tone={balanceTone(balance)}>{balanceLabel(balance)}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Charged {formatMoney(statement.charges)} · Received {formatMoney(statement.payments)}
                </p>
              </Surface>
            ) : null}
            <Surface className="p-5">
              <SectionTitle title="Recent activity" />
              <ul className="space-y-2 text-sm">
                {payments.slice(0, 3).map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3">
                    <span>{payment.receiptNumber}</span>
                    <span className="text-muted-foreground">{formatDate(payment.date)}</span>
                  </li>
                ))}
                {payments.length === 0 ? <li className="text-muted-foreground">No payments recorded.</li> : null}
              </ul>
            </Surface>
          </div>
        </TabsContent>

        {finance ? (
          <TabsContent value="fees" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <LinkButton href={`/fees/record?student=${student.id}`}>Record payment</LinkButton>
              <LinkButton variant="outline" href={`/fees/statements/${student.id}`}>
                View statement
              </LinkButton>
            </div>
            <Surface>
              <div className="p-5">
                <SectionTitle title="Charges" />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Charge</TableHead>
                      <TableHead className="hidden sm:table-cell">Issued</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((charge) => {
                      const remaining = chargeBalance(state, charge.id);
                      return (
                        <TableRow key={charge.id}>
                          <TableCell>
                            {charge.label}
                            <p className="text-xs text-muted-foreground sm:hidden">{formatDate(charge.issuedOn)}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{formatDate(charge.issuedOn)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(charge.amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(remaining)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={remaining === 0 ? "success" : "danger"}>{remaining === 0 ? "Paid" : "Outstanding"}</StatusBadge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Surface>
            <Surface>
              <div className="p-5">
                <SectionTitle title="Payments" />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="hidden md:table-cell">Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.receiptNumber}
                          <p className="text-xs text-muted-foreground sm:hidden">{formatDate(payment.date)} · {payment.method}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{formatDate(payment.date)}</TableCell>
                        <TableCell className="hidden md:table-cell">{payment.method}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(payment.amount)}</TableCell>
                        <TableCell>
                          <Link className="text-sm font-medium text-blue" href={`/fees/receipts/${payment.id}`}>
                            Receipt
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Surface>
          </TabsContent>
        ) : null}

        <TabsContent value="academics" className="mt-4 space-y-4">
          {academic.length === 0 ? (
            <Surface className="p-6 text-sm text-muted-foreground">No assessment has been configured for this class in {state.term}.</Surface>
          ) : (
            academic.map(({ sheet, config }) => {
              if (!config) return null;
              const row = sheet.rows.find((item) => item.studentId === student.id);
              const summary = row ? summariseRow(config.components, row.scores, state.school.grading) : null;
              return (
                <Surface key={sheet.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-navy">{subjectName(state, config.subjectId)}</h3>
                    <StatusBadge tone={sheetStatusTone(sheet.status)}>{sheetStatusLabel(sheet.status)}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {config.year} · {config.term}
                    {summary ? <span className="sm:hidden"> · Total {summary.total ?? "—"} · Grade {summary.grade ?? "—"}</span> : null}
                  </p>
                  {row && summary ? (
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {config.components.map((component) => (
                              <TableHead key={component.id}>{component.name}</TableHead>
                            ))}
                            <TableHead className="hidden sm:table-cell">Total</TableHead>
                            <TableHead className="hidden sm:table-cell">Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            {config.components.map((component) => (
                              <TableCell key={component.id}>
                                {row.scores[component.id] == null ? "Missing" : row.scores[component.id]}
                              </TableCell>
                            ))}
                            <TableCell className="hidden sm:table-cell">{summary.total ?? "—"}</TableCell>
                            <TableCell className="hidden sm:table-cell">{summary.grade ?? "—"}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">This student is not on the mark sheet.</p>
                  )}
                  {summary && summary.missing.length > 0 ? (
                    <p className="mt-3 text-sm text-ink">Missing: {summary.missing.join(", ")}. A missing mark is not scored as zero.</p>
                  ) : null}
                  {sheet.status === "published" ? (
                    <Link className="mt-3 inline-block text-sm font-medium text-blue" href={`/report-cards/${student.id}`}>
                      Open report card
                    </Link>
                  ) : null}
                </Surface>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="guardian" className="mt-4 space-y-4">
          {guardians.map((guardian) => (
            <Surface key={guardian.id} className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-navy">{guardian.fullName}</h3>
                {guardian.primary ? <StatusBadge tone="info">Primary</StatusBadge> : null}
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Fact label="Relationship" value={guardian.relationship} />
                <Fact label="Phone" value={guardian.phone || "—"} />
                <Fact label="Email" value={guardian.email || "—"} />
                <Fact label="Occupation" value={guardian.occupation || "—"} />
              </dl>
            </Surface>
          ))}
          <Surface className="p-5">
            <SectionTitle title="Add a guardian" />
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (guardianName.trim().length < 2 || guardianPhone.trim().length < 6) {
                  setGuardianError("Enter the guardian's name and a phone number.");
                  return;
                }
                dispatch({
                  type: "add-guardian",
                  guardian: {
                    id: `g-${Date.now()}`,
                    studentId: student.id,
                    fullName: guardianName.trim(),
                    relationship,
                    phone: guardianPhone.trim(),
                    email: "",
                    occupation: "",
                    primary: guardians.length === 0,
                  },
                });
                setGuardianName("");
                setGuardianPhone("");
                setGuardianError("");
              }}
            >
              <Input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="Full name" aria-label="Guardian name" />
              <Input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Relationship" aria-label="Relationship" />
              <Input value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} placeholder="Phone" aria-label="Phone" />
              {guardianError ? <p className="text-xs text-danger sm:col-span-3">{guardianError}</p> : null}
              <div className="sm:col-span-3">
                <Button type="submit">Save guardian</Button>
              </div>
            </form>
          </Surface>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Surface className="p-5">
            <SectionTitle title="Student details" />
            <StudentForm
              classes={state.classes}
              submitLabel="Save changes"
              initial={student as unknown as StudentFormValues}
              onSubmit={(values) => {
                const duplicate = state.students.some(
                  (item) => item.id !== student.id && item.admissionNumber.toLowerCase() === values.admissionNumber.toLowerCase(),
                );
                if (duplicate) return "That admission number is already in use.";
                dispatch({ type: "update-student", student: toStudent(student.id, values) });
              }}
            />
            <p className="mt-3 text-xs text-muted-foreground">Saving updates the school record.</p>
          </Surface>
        </TabsContent>
      </Tabs>
      <div className="mt-4">
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-ink">{value}</dd>
    </div>
  );
}
