import { AcademicOverview } from "@/components/academics/academic-overview";
import { requireAcademics } from "@/lib/server/guard";

export default async function AcademicsPage() {
  await requireAcademics();
  return <AcademicOverview />;
}
