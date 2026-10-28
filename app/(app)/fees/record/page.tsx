import { Suspense } from "react";
import { LoadingRows, Surface } from "@/components/common/ui-bits";
import { OfficeFrame } from "@/components/data/office-frame";
import { RecordPayment } from "@/components/fees/record-payment";
import { requireFinance } from "@/lib/server/guard";

export default async function RecordPaymentPage() {
  await requireFinance();
  return (
    <Suspense
      fallback={
        <Surface>
          <LoadingRows />
        </Surface>
      }
    >
      <OfficeFrame scope="fees">
        <RecordPayment />
      </OfficeFrame>
    </Suspense>
  );
}
