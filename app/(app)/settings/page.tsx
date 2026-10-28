import { redirect } from "next/navigation";
import { OfficeFrame } from "@/components/data/office-frame";
import { SettingsScreen } from "@/components/admin/settings-screen";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) redirect("/dashboard");
  return (
    <OfficeFrame scope="settings">
      <SettingsScreen />
    </OfficeFrame>
  );
}
