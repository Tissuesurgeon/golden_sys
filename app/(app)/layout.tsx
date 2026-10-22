import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { PrototypeProvider } from "@/lib/prototype/store";
import { loadSnapshot } from "@/lib/server/snapshot";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const initial = await loadSnapshot(user);
  return (
    <PrototypeProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </PrototypeProvider>
  );
}
