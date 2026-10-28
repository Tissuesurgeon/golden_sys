import { OfficeFrame } from "@/components/data/office-frame";
import { AssessmentConfigScreen } from "@/components/academics/assessment-config";
import { requireAcademics } from "@/lib/server/guard";

export default async function AssessmentsPage() {
  await requireAcademics();
  return (
    <OfficeFrame scope="academics">
      <AssessmentConfigScreen />
    </OfficeFrame>
  );
}
