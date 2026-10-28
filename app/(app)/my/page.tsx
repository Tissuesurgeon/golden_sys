import Link from "next/link";
import { PageHeader, StatusBadge, Surface, sheetStatusLabel, sheetStatusTone } from "@/components/common/ui-bits";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { requireAcademics } from "@/lib/server/guard";

export default async function MyClassesPage() {
  const user = await requireAcademics();
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const term = settings?.currentTermId ? await prisma.term.findUnique({ where: { id: settings.currentTermId }, include: { year: true } }) : null;
  const staffId = user.staffId;
  const [homes, assignments, sheets] = await Promise.all([
    staffId ? prisma.classRoom.findMany({ where: { teacherId: staffId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    staffId && term
      ? prisma.teacherAssignment.findMany({
          where: { staffId, yearId: term.yearId },
          include: { classRoom: true, subject: true },
          orderBy: { classRoom: { name: "asc" } },
        })
      : Promise.resolve([]),
    staffId && term
      ? prisma.markSheet.findMany({
          where: { config: { yearId: term.yearId, termLabel: term.label, OR: [{ classRoom: { teacherId: staffId } }, { classRoom: { assignments: { some: { staffId } } } }] } },
          include: { config: { include: { classRoom: true, subject: true } } },
          orderBy: { config: { classRoom: { name: "asc" } } },
        })
      : Promise.resolve([]),
  ]);
  const homeIds = new Set(homes.map((room) => room.id));

  return (
    <div>
      <PageHeader
        title="My classes"
        description={term ? `${term.label}, ${term.year.label}` : "No current term is set."}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="p-5">
          <h2 className="text-lg font-semibold text-navy">Class teacher</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {homes.length === 0 ? <li className="py-2 text-muted-foreground">You are not the class teacher of a class this term.</li> : null}
            {homes.map((room) => (
              <li key={room.id} className="flex items-center justify-between gap-3 py-2">
                <span>{room.name}</span>
                <span className="flex gap-3">
                  <Link className="text-blue" href={`/attendance?classId=${room.id}`}>Attendance</Link>
                  <Link className="text-blue" href={`/roster?classId=${room.id}`}>Roster</Link>
                </span>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="p-5">
          <h2 className="text-lg font-semibold text-navy">Subjects</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {assignments.length === 0 ? <li className="py-2 text-muted-foreground">No subject assignment for this year.</li> : null}
            {assignments.map((item) => (
              <li key={item.id} className="flex justify-between py-2">
                <span>{item.classRoom.name}</span>
                <span>{item.subject.name}</span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
      <Surface className="mt-4 overflow-x-auto">
        <h2 className="px-4 pt-4 text-lg font-semibold text-navy">Mark sheets</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="px-4 py-2">Class</th><th className="px-4 py-2">Subject</th><th className="px-4 py-2">Deadline</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id} className="border-t border-border">
                <td className="px-4 py-2">{sheet.config.classRoom.name}</td>
                <td className="px-4 py-2">{sheet.config.subject.name}</td>
                <td className="px-4 py-2">{sheet.config.deadline ? isoDate(sheet.config.deadline) : "—"}</td>
                <td className="px-4 py-2"><StatusBadge tone={sheetStatusTone(sheet.status)}>{sheetStatusLabel(sheet.status)}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {homeIds.size > 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">Enter marks from the Marks page. Only your assigned subject can be edited.</p> : null}
      </Surface>
    </div>
  );
}
