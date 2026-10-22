import { StatementView } from "@/components/fees/statement-view";
import { requireFinance } from "@/lib/server/guard";

export default async function StatementPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireFinance();
  const { studentId } = await params;
  return <StatementView studentId={studentId} />;
}
