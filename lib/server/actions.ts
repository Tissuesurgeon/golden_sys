"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumePasswordReset, destroySession, issuePasswordReset, requireUser, signInWithPassword } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { applyAction } from "@/lib/server/mutate";
import { prisma } from "@/lib/db";

export async function signInAction(email: string, password: string) {
  const result = await signInWithPassword(email, password);
  if (!result.ok) return { error: result.error };
  return { error: "" };
}

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}

export async function commitAction(action: { type: string; [key: string]: unknown }) {
  const user = await requireUser();
  try {
    const result = await applyAction(user, action as Parameters<typeof applyAction>[1]);
    revalidatePath("/", "layout");
    return { error: "", ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That action could not be saved." };
  }
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
