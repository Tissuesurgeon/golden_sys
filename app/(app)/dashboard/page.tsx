import { OfficeFrame } from "@/components/data/office-frame";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export default function DashboardPage() {
  return (
    <OfficeFrame scope="dashboard">
      <DashboardScreen />
    </OfficeFrame>
  );
}
