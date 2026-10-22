import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function requireFinance() {
  const user = await requireUser();
  if (!can(user.role, "finance.read")) redirect("/dashboard");
  return user;
}

export async function requireAcademics() {
  const user = await requireUser();
  if (!can(user.role, "academics.read")) redirect("/dashboard");
  return user;
}
