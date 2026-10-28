import { OfficeFrame } from "@/components/data/office-frame";
import { StatementView } from "@/components/fees/statement-view";
import { prisma } from "@/lib/db";
import { invoiceBalance } from "@/lib/finance";
import { requireFinance } from "@/lib/server/guard";

export default async function StatementPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireFinance();
  const { studentId } = await params;
  const invoices = await prisma.invoice.findMany({
    where: { studentId },
    include: { items: true, adjustments: true, allocations: { include: { payment: true } } },
  });
  const openBalance = invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice).balance, 0);
  return (
    <OfficeFrame scope="student" focusId={studentId}>
      <StatementView studentId={studentId} openBalance={openBalance} />
    </OfficeFrame>
  );
}
