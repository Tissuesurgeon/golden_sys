import { Suspense } from "react";
import { LoadingRows, Surface } from "@/components/common/ui-bits";
import { OfficeFrame } from "@/components/data/office-frame";
import { StudentDirectory } from "@/components/students/student-directory";

export default function StudentsPage() {
  return (
    <Suspense
      fallback={
        <Surface>
          <LoadingRows />
        </Surface>
      }
    >
      <OfficeFrame scope="students">
        <StudentDirectory />
      </OfficeFrame>
    </Suspense>
  );
}
