import { StatementView } from "@/components/fees/statement-view";

export default async function StatementPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StatementView studentId={studentId} />;
}
