import { Suspense } from "react";
import { LoadingRows, Surface } from "@/components/common/ui-bits";
import { RecordPayment } from "@/components/fees/record-payment";

export default function RecordPaymentPage() {
  return (
    <Suspense
      fallback={
        <Surface>
          <LoadingRows />
        </Surface>
      }
    >
      <RecordPayment />
    </Suspense>
  );
}
