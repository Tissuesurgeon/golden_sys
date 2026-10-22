import { FeesOverview } from "@/components/fees/fees-overview";
import { requireFinance } from "@/lib/server/guard";

export default async function FeesPage() {
  await requireFinance();
  return <FeesOverview />;
}
