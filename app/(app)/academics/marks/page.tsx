import { OfficeFrame } from "@/components/data/office-frame";
import { MarksEntry } from "@/components/academics/marks-entry";
import { requireAcademics } from "@/lib/server/guard";

export default async function MarksPage() {
  await requireAcademics();
  return (
    <OfficeFrame scope="academics">
      <MarksEntry />
    </OfficeFrame>
  );
}
