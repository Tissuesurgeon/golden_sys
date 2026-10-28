import { OfficeFrame } from "@/components/data/office-frame";
import { AcademicOverview } from "@/components/academics/academic-overview";
import { requireAcademics } from "@/lib/server/guard";

export default async function AcademicsPage() {
  await requireAcademics();
  return (
    <OfficeFrame scope="academics">
      <AcademicOverview />
    </OfficeFrame>
  );
}
