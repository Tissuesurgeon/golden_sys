import { AppShell } from "@/components/shell/app-shell";
import { PrototypeProvider } from "@/lib/prototype/store";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrototypeProvider>
      <AppShell>{children}</AppShell>
    </PrototypeProvider>
  );
}
