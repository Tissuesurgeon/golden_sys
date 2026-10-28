import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { loadShell } from "@/lib/server/snapshot";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const shell = await loadShell(user);
  return <AppShell user={shell.user} school={shell.school}>{children}</AppShell>;
}
