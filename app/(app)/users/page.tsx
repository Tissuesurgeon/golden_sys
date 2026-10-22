import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { UsersScreen } from "@/components/admin/users-screen";

export default async function UsersPage() {
  const user = await requireUser();
  if (!can(user.role, "users.manage")) redirect("/dashboard");
  const accounts = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return (
    <UsersScreen
      accounts={accounts.map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        active: account.active,
      }))}
    />
  );
}
