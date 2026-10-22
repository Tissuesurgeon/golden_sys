import { redirect } from "next/navigation";
import { GuardianDirectory, type GuardianRow } from "@/components/guardians/guardian-directory";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function GuardiansPage() {
  const user = await requireUser();
  if (!can(user.role, "students.read") || user.role === "teacher") redirect("/dashboard");
  const guardians = await prisma.guardian.findMany({
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                where: { active: true },
                include: { classRoom: true, year: true },
                orderBy: { year: { startsOn: "desc" } },
              },
            },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const rows: GuardianRow[] = guardians.map((guardian) => ({
    id: guardian.id,
    fullName: guardian.fullName,
    phone: guardian.phone,
    email: guardian.email,
    occupation: guardian.occupation,
    students: guardian.students
      .map((link) => ({
        id: link.student.id,
        name: `${link.student.firstName} ${link.student.lastName}`.trim(),
        className: link.student.enrollments[0]?.classRoom.name ?? "",
        relationship: link.relationship,
        primary: link.primary,
        status: link.student.status,
      }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name)),
  }));

  return <GuardianDirectory guardians={rows} />;
}
