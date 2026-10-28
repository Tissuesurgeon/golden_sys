import { PrototypeProvider } from "@/lib/prototype/store";
import { requireUser } from "@/lib/auth";
import { loadOffice, type OfficeScope } from "@/lib/server/snapshot";

export async function OfficeFrame({ scope, focusId, children }: { scope: OfficeScope; focusId?: string; children: React.ReactNode }) {
  const user = await requireUser();
  const initial = await loadOffice(user, scope, focusId);
  return <PrototypeProvider initial={initial}>{children}</PrototypeProvider>;
}
