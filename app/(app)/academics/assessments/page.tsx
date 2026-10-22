import { AssessmentConfigScreen } from "@/components/academics/assessment-config";
import { requireAcademics } from "@/lib/server/guard";

export default async function AssessmentsPage() {
  await requireAcademics();
  return <AssessmentConfigScreen />;
}
