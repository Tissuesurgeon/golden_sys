import { PageHeader, Surface } from "@/components/common/ui-bits";
import { PrintButton } from "@/components/print/print-button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const user = await requireUser();
  const { classId } = await searchParams;
  const room = classId
    ? await prisma.classRoom.findUnique({ where: { id: classId } })
    : null;
  if (!room) return <Surface className="p-8 text-sm">Choose a class from My Classes.</Surface>;
  if (user.role === "teacher" && room.teacherId !== user.staffId) {
    return <Surface className="p-8 text-sm">This roster belongs to the class teacher.</Surface>;
  }
  if (user.role === "bursar") return <Surface className="p-8 text-sm">Rosters are for class teachers and administrators.</Surface>;
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const students = await prisma.student.findMany({
    where: { enrollments: { some: { classId: room.id, active: true, ...(settings?.academicYearId ? { yearId: settings.academicYearId } : {}) } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return (
    <div>
      <div className="no-print">
        <PageHeader title={`${room.name} roster`} description="Print this list for the class." actions={<PrintButton label="Print roster" />} />
      </div>
      <Surface className="print-sheet p-6">
        <h1 className="text-xl font-semibold text-navy">{room.name}</h1>
        <p className="text-sm text-muted-foreground">{students.length} students</p>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">#</th><th>Admission number</th><th>Name</th><th>Sex</th></tr></thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id} className="border-t border-border">
                <td className="py-2">{index + 1}</td>
                <td>{student.admissionNumber}</td>
                <td>{student.lastName}, {student.firstName}</td>
                <td>{student.sex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </div>
  );
}
