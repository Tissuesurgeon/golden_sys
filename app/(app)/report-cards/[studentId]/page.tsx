import { Suspense } from "react";
import { OfficeFrame } from "@/components/data/office-frame";
import { ReportCardView } from "@/components/reports/report-card";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireAcademics();
  const { studentId } = await params;
  return (
    <Suspense fallback={null}>
      <OfficeFrame scope="reports" focusId={studentId}>
        <ReportCardView studentId={studentId} />
      </OfficeFrame>
    </Suspense>
  );
}
