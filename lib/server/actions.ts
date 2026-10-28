"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumePasswordReset, destroySession, issuePasswordReset, requireUser, signInWithPassword } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function signInAction(email: string, password: string) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  const result = await signInWithPassword(email, password, ip);
  if (!result.ok) return { error: result.error, role: "" };
  return { error: "", role: result.role };
}

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}

export async function resetLinkAction(userId: string) {
  const actor = await requireUser();
  assertCan(actor.role, "users.manage");
  const issued = await issuePasswordReset(userId, actor.id);
  revalidatePath("/users");
  return { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
}

export async function setActiveAction(userId: string, active: boolean) {
  const actor = await requireUser();
  assertCan(actor.role, "users.manage");
  if (actor.id === userId && !active) return { error: "You cannot deactivate your own account." };
  await prisma.user.update({ where: { id: userId }, data: { active } });
  if (!active) await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/users");
  return { error: "" };
}

export async function completeResetAction(token: string, password: string) {
  const result = await consumePasswordReset(token, password);
  if (!result.ok) return { error: result.error };
  redirect("/login");
}
