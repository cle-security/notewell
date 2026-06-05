import crypto from "node:crypto";
import { prisma } from "./db.js";

export const SESSION_COOKIE = "notewell_sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  return { id, expiresAt };
}

export async function loadSession(id: string) {
  const s = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (s.user.disabled) return null;
  return s;
}

export async function destroySession(id: string) {
  await prisma.session.delete({ where: { id } }).catch(() => {});
}
