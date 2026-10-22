import { ReportDirectory } from "@/components/reports/report-directory";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReportCardsPage() {
  await requireAcademics();
  return <ReportDirectory />;
}
