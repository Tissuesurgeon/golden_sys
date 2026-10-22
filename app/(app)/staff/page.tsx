import { redirect } from "next/navigation";
import { StaffScreen } from "@/components/admin/staff-screen";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function StaffPage() {
  const user = await requireUser();
  if (!can(user.role, "staff.manage")) redirect("/dashboard");
  return <StaffScreen />;
}
