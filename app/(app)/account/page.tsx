import { AccountPassword } from "@/components/auth/account-password";
import { PageHeader, Surface } from "@/components/common/ui-bits";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="My account" description={`${user.name} · ${user.email}`} />
      <Surface className="max-w-md p-5">
        <h2 className="text-lg font-semibold text-navy">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Other sessions on this account are signed out.</p>
        <AccountPassword />
      </Surface>
    </div>
  );
}
