import { OfficeFrame } from "@/components/data/office-frame";
import { ClassesScreen } from "@/components/admin/classes-screen";

export default function ClassesPage() {
  return (
    <OfficeFrame scope="classes">
      <ClassesScreen />
    </OfficeFrame>
  );
}
