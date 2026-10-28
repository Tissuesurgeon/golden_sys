"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveAttendance, saveTermReports } from "@/lib/server/teacher";

type StudentRow = { id: string; name: string; admissionNumber: string };
type Mark = { status: "present" | "absent" | "late" | "excused"; note: string };
type Remark = { remark: string; conduct: string; attitude: string; interest: string };

export function AttendanceRegister({
  classId,
  termId,
  date,
  students,
  marks,
  remarks,
}: {
  classId: string;
  termId: string;
  date: string;
  students: StudentRow[];
  marks: Record<string, Mark>;
  remarks: Record<string, Remark>;
}) {
  const [rows, setRows] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(students.map((student) => [student.id, marks[student.id] ?? { status: "present", note: "" }])),
  );
  const [comments, setComments] = useState<Record<string, Remark>>(() =>
    Object.fromEntries(students.map((student) => [student.id, remarks[student.id] ?? { remark: "", conduct: "", attitude: "", interest: "" }])),
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function saveDay() {
    setPending(true);
    setMessage("");
    try {
      await saveAttendance({
        classId,
        termId,
        date,
        rows: students.map((student) => ({ studentId: student.id, ...rows[student.id] })),
      });
      setMessage("Attendance saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function saveRemarks() {
    setPending(true);
    setMessage("");
    try {
      await saveTermReports({
        classId,
        termId,
        rows: students.map((student) => ({ studentId: student.id, ...comments[student.id] })),
      });
      setMessage("Term remarks saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Remarks could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-border">
                <td className="px-4 py-2">
                  {student.name}
                  <span className="block text-xs text-muted-foreground">{student.admissionNumber}</span>
                </td>
                <td className="px-4 py-2">
                  <select
                    className="h-11 rounded-lg border border-border bg-white px-2"
                    value={rows[student.id]?.status ?? "present"}
                    onChange={(event) => setRows((current) => ({ ...current, [student.id]: { ...current[student.id], status: event.target.value as Mark["status"] } }))}
                    aria-label={`Status for ${student.name}`}
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    className="h-11 w-full rounded-lg border border-border px-2"
                    value={rows[student.id]?.note ?? ""}
                    onChange={(event) => setRows((current) => ({ ...current, [student.id]: { ...current[student.id], note: event.target.value } }))}
                    aria-label={`Note for ${student.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" disabled={pending} onClick={saveDay}>Save this day</Button>
      <div className="overflow-x-auto">
        <h2 className="px-4 pb-2 text-lg font-semibold text-navy">Term remarks</h2>
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Remark</th>
              <th className="px-4 py-2">Conduct</th>
              <th className="px-4 py-2">Attitude</th>
              <th className="px-4 py-2">Interest</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-border">
                <td className="px-4 py-2">{student.name}</td>
                {(["remark", "conduct", "attitude", "interest"] as const).map((field) => (
                  <td key={field} className="px-4 py-2">
                    <input
                      className="h-11 w-full rounded-lg border border-border px-2"
                      value={comments[student.id]?.[field] ?? ""}
                      onChange={(event) => setComments((current) => ({ ...current, [student.id]: { ...current[student.id], [field]: event.target.value } }))}
                      aria-label={`${field} for ${student.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" disabled={pending} onClick={saveRemarks}>Save term remarks</Button>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </div>
  );
}
