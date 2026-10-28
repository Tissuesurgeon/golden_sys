import { OfficeFrame } from "@/components/data/office-frame";
import { ResultsReview } from "@/components/academics/results-review";
import { requireAcademics } from "@/lib/server/guard";

export default async function ReviewPage() {
  await requireAcademics();
  return (
    <OfficeFrame scope="academics">
      <ResultsReview />
    </OfficeFrame>
  );
}
