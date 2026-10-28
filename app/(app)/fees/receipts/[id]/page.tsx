import { OfficeFrame } from "@/components/data/office-frame";
import { ReceiptView } from "@/components/fees/receipt-view";
import { requireFinance } from "@/lib/server/guard";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFinance();
  const { id } = await params;
  return (
    <OfficeFrame scope="fees">
      <ReceiptView paymentId={id} />
    </OfficeFrame>
  );
}
