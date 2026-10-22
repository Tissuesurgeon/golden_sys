import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

const COOKIE = "gcs_session";
const SESSION_DAYS = 14;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  staffId: string | null;
  active: boolean;
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    staffId: session.user.staffId,
    active: session.user.active,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function signInWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) return { ok: false as const, error: "Those sign-in details were not recognised." };
  const match = await verifyPassword(user.passwordHash, password);
  if (!match) return { ok: false as const, error: "Those sign-in details were not recognised." };
  await createSession(user.id);
  return { ok: true as const };
}

export async function issuePasswordReset(userId: string, actorId: string) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordReset.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  const { writeAudit } = await import("@/lib/audit");
  await writeAudit({
    actorId,
    action: "password_reset.issued",
    entityType: "User",
    entityId: userId,
    summary: "Issued a password reset link",
  });
  return { token, expiresAt };
}

export async function consumePasswordReset(token: string, password: string) {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { ok: false as const, error: "This reset link is no longer valid." };
  if (password.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { ok: true as const };
}
