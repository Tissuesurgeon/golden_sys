import { Suspense } from "react";
import { OfficeFrame } from "@/components/data/office-frame";
import { ReportCardView } from "@/components/reports/report-card";
import { attendanceTotals } from "@/lib/academics";
import { isoDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireAcademics();
  const { studentId } = await params;
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "school" } });
  const term = settings?.currentTermId ? await prisma.term.findUnique({ where: { id: settings.currentTermId } }) : null;
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { studentId, active: true, ...(term ? { yearId: term.yearId } : {}) },
    include: { classRoom: true },
  });
  const [own, classRows, termReport, snapshot] = await Promise.all([
    term ? prisma.attendance.findMany({ where: { studentId, termId: term.id } }) : Promise.resolve([]),
    term && enrollment ? prisma.attendance.findMany({ where: { classId: enrollment.classId, termId: term.id }, select: { date: true } }) : Promise.resolve([]),
    term ? prisma.termReport.findUnique({ where: { studentId_termId: { studentId, termId: term.id } } }) : Promise.resolve(null),
    prisma.reportCardSnapshot.findFirst({ where: { studentId }, orderBy: { version: "desc" } }),
  ]);
  const daysOpen = new Set(classRows.map((row) => isoDate(row.date))).size;
  const payload = (snapshot?.payload ?? {}) as { position?: number | null };
  const showPosition = enrollment?.classRoom.level === "Primary" || enrollment?.classRoom.level === "JHS";
  return (
    <Suspense fallback={null}>
      <OfficeFrame scope="reports" focusId={studentId}>
        <ReportCardView
          studentId={studentId}
          position={showPosition ? (payload.position ?? null) : null}
          attendance={term ? attendanceTotals(own, daysOpen) : null}
          termReport={termReport}
        />
      </OfficeFrame>
    </Suspense>
  );
}
