import { OfficeFrame } from "@/components/data/office-frame";
import { FeesOverview } from "@/components/fees/fees-overview";
import { requireFinance } from "@/lib/server/guard";

export default async function FeesPage() {
  await requireFinance();
  return (
    <OfficeFrame scope="fees">
      <FeesOverview />
    </OfficeFrame>
  );
}
