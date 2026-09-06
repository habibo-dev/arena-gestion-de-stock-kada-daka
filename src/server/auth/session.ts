import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import { getDb, schema } from "@/server/db/client";
import { hasPermission, type Permission, type Role } from "@/lib/permissions";

export const SESSION_COOKIE = "autostock_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
};

export class AuthError extends Error {
  constructor(message = "Authentification requise.") {
    super(message);
    this.name = "AuthError";
  }
}

export class PermissionError extends Error {
  constructor(message = "Vous n'avez pas les droits nécessaires pour cette action.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** Resolve the current user from the session cookie. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const row = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      fullName: schema.users.fullName,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
    .get();

  if (!row || !row.isActive) return null;
  return { id: row.id, username: row.username, fullName: row.fullName, email: row.email, role: row.role };
});

/**
 * Server actions: throw typed errors (turned into ActionResult by runAction/safeRun).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) throw new PermissionError();
  return user;
}

/**
 * Server components (pages): an expired/invalid session redirects to the login
 * page; a missing permission renders the dedicated "Accès refusé" page.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?expired=1");
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requirePageUser();
  if (!hasPermission(user.role, permission)) redirect(`/acces-refuse?droit=${encodeURIComponent(permission)}`);
  return user;
}

export async function login(username: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const db = getDb();
  const user = db.select().from(schema.users).where(eq(schema.users.username, username.trim().toLowerCase())).get();
  if (!user || !user.isActive) return { ok: false, error: "Identifiant ou mot de passe incorrect." };
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Identifiant ou mot de passe incorrect." };

  const token = nanoid(40);
  const expiresAt = addDays(new Date(), SESSION_DAYS).toISOString();
  db.insert(schema.sessions).values({ id: token, userId: user.id, expiresAt }).run();
  db.update(schema.users).set({ lastLoginAt: new Date().toISOString() }).where(eq(schema.users.id, user.id)).run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: new Date(expiresAt),
  });

  return {
    ok: true,
    user: { id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role },
  };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
  }
  store.delete(SESSION_COOKIE);
}
