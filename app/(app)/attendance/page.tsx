import Link from "next/link";
import { AttendanceRegister } from "@/components/academics/attendance-register";
import { PageHeader, Surface, selectClassName } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ classId?: string; date?: string; month?: string }> }) {
  const user = await requireUser();
  if (user.role === "bursar") return <Surface className="p-8 text-sm">Attendance is for class teachers and administrators.</Surface>;
  const query = await searchParams;
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const term = settings?.currentTermId ? await prisma.term.findUnique({ where: { id: settings.currentTermId }, include: { year: true } }) : null;
  if (!term) return <Surface className="p-8 text-sm">Set the current term before marking attendance.</Surface>;
  const rooms = await prisma.classRoom.findMany({
    where: user.role === "administrator" ? {} : { teacherId: user.staffId ?? "__none__" },
    orderBy: { name: "asc" },
  });
  const classId = rooms.some((room) => room.id === query.classId) ? query.classId! : rooms[0]?.id;
  const date = query.date || isoDate(new Date());
  const month = query.month || date.slice(0, 7);
  if (!classId) return <Surface className="p-8 text-sm">You are not the class teacher of a class.</Surface>;
  const [students, marks, monthMarks, remarks] = await Promise.all([
    prisma.student.findMany({
      where: { status: "active", enrollments: { some: { classId, yearId: term.yearId, active: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.attendance.findMany({ where: { classId, date: new Date(`${date}T00:00:00.000Z`) } }),
    prisma.attendance.findMany({
      where: { classId, termId: term.id, date: { gte: new Date(`${month}-01T00:00:00.000Z`), lt: new Date(nextMonth(month)) } },
    }),
    prisma.termReport.findMany({ where: { termId: term.id, student: { enrollments: { some: { classId, active: true } } } } }),
  ]);
  const dayCount = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const byStudent = new Map(marks.map((row) => [row.studentId, row]));
  const remarkByStudent = new Map(remarks.map((row) => [row.studentId, row]));

  return (
    <div>
      <PageHeader title="Attendance" description={`${term.label}, ${term.year.label}. Everyone starts as present until you change the row.`} />
      <Surface className="mb-4 p-5">
        <form className="grid gap-3 md:grid-cols-4">
          <select className={selectClassName()} name="classId" defaultValue={classId} aria-label="Class">
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <Input name="date" type="date" defaultValue={date} aria-label="Date" />
          <Input name="month" type="month" defaultValue={month} aria-label="Register month" />
          <Button type="submit" variant="outline">Show register</Button>
        </form>
      </Surface>
      <Surface className="mb-4">
        <AttendanceRegister
          classId={classId}
          termId={term.id}
          date={date}
          students={students.map((student) => ({ id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber }))}
          marks={Object.fromEntries(students.map((student) => {
            const mark = byStudent.get(student.id);
            return [student.id, mark ? { status: mark.status, note: mark.note } : { status: "present" as const, note: "" }];
          }))}
          remarks={Object.fromEntries(students.map((student) => {
            const row = remarkByStudent.get(student.id);
            return [student.id, { remark: row?.remark ?? "", conduct: row?.conduct ?? "", attitude: row?.attitude ?? "", interest: row?.interest ?? "" }];
          }))}
        />
      </Surface>
      <Surface className="overflow-x-auto p-4">
        <h2 className="mb-3 text-lg font-semibold text-navy">Monthly register</h2>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left">Student</th>
              {days.map((day) => <th key={day} className="px-1 py-1 font-medium">{day.slice(8)}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-border">
                <td className="sticky left-0 bg-white px-2 py-1">{student.lastName}</td>
                {days.map((day) => {
                  const mark = monthMarks.find((row) => row.studentId === student.id && isoDate(row.date) === day);
                  return <td key={day} className="px-1 py-1 text-center">{mark ? mark.status.slice(0, 1).toUpperCase() : ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">P present, A absent, L late, E excused. <Link className="text-blue" href={`/roster?classId=${classId}`}>Open the class roster</Link></p>
      </Surface>
    </div>
  );
}

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const next = value === 12 ? { year: year + 1, month: 1 } : { year, month: value + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-01T00:00:00.000Z`;
}
