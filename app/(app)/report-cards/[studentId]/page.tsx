import { Suspense } from "react";
import { ReportCardView } from "@/components/reports/report-card";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireAcademics();
  const { studentId } = await params;
  return (
    <Suspense fallback={null}>
      <ReportCardView studentId={studentId} />
    </Suspense>
  );
}
