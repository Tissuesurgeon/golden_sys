import { Suspense } from "react";
import { ReportCardView } from "@/components/reports/report-card";

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return (
    <Suspense fallback={null}>
      <ReportCardView studentId={studentId} />
    </Suspense>
  );
}
