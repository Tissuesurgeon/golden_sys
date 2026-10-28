import { OfficeFrame } from "@/components/data/office-frame";
import { ReportDirectory } from "@/components/reports/report-directory";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReportCardsPage() {
  await requireAcademics();
  return (
    <OfficeFrame scope="reports">
      <ReportDirectory />
    </OfficeFrame>
  );
}
