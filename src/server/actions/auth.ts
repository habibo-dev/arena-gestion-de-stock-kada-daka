"use server";

import { loginSchema, userSchema, settingsSchema, changePasswordSchema } from "@/lib/schemas/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { login, logout, requirePermission, requireUser } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import { getDb, schema } from "@/server/db/client";
import { BusinessError } from "@/lib/result";
import { getAllSettings, setSetting, type SettingKey } from "@/server/services/settings";

export async function loginAction(input: unknown) {
  return runAction(loginSchema, input, async (data) => {
    const res = await login(data.username, data.password);
    if (!res.ok) throw new BusinessError(res.error);
    return res.user;
  });
}

export async function logoutAction() {
  await logout();
  redirect("/connexion");
}

/* ------------------------------- Users ------------------------------------ */

export async function createUserAction(input: unknown) {
  return runAction(userSchema, input, async (data) => {
    await requirePermission("users.manage");
    if (!data.password) throw new BusinessError("Le mot de passe est obligatoire pour un nouvel utilisateur.");
    const db = getDb();
    const [row] = db
      .insert(schema.users)
      .values({ username: data.username, fullName: data.fullName, email: data.email || null, role: data.role, passwordHash: bcrypt.hashSync(data.password, 10), isActive: data.isActive ?? true })
      .returning({ id: schema.users.id })
      .all();
    revalidatePath("/utilisateurs");
    return { id: row!.id };
  });
}

export async function updateUserAction(id: number, input: unknown) {
  return runAction(userSchema, input, async (data) => {
    const me = await requirePermission("users.manage");
    const db = getDb();
    if (me.id === id && data.role !== "ADMIN") throw new BusinessError("Vous ne pouvez pas retirer votre propre rôle administrateur.");
    if (me.id === id && data.isActive === false) throw new BusinessError("Vous ne pouvez pas désactiver votre propre compte.");
    const admins = db.select({ c: sql<number>`count(*)` }).from(schema.users).where(sql`role = 'ADMIN' AND is_active = 1 AND id <> ${id}`).get()?.c ?? 0;
    const current = db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, id)).get();
    if (!current) throw new BusinessError("Utilisateur introuvable.");
    if (current.role === "ADMIN" && (data.role !== "ADMIN" || data.isActive === false) && admins === 0) {
      throw new BusinessError("Il doit rester au moins un administrateur actif.");
    }
    db.update(schema.users)
      .set({
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
        role: data.role,
        ...(data.password ? { passwordHash: bcrypt.hashSync(data.password, 10) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.users.id, id))
      .run();
    if (data.isActive === false) db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).run();
    revalidatePath("/utilisateurs");
    return { id };
  });
}

export async function changeOwnPasswordAction(input: unknown) {
  return runAction(changePasswordSchema, input, async (data) => {
    const me = await requireUser();
    const db = getDb();
    const row = db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, me.id)).get();
    if (!row || !(await bcrypt.compare(data.currentPassword, row.hash))) throw new BusinessError("Mot de passe actuel incorrect.");
    db.update(schema.users).set({ passwordHash: bcrypt.hashSync(data.newPassword, 10), updatedAt: new Date().toISOString() }).where(eq(schema.users.id, me.id)).run();
    return true;
  });
}

/* ------------------------------ Settings ---------------------------------- */

export async function saveSettingsAction(input: unknown) {
  return runAction(settingsSchema, input, async (data) => {
    await requirePermission("settings.manage");
    for (const [k, v] of Object.entries(data)) setSetting(k as SettingKey, v);
    revalidatePath("/", "layout");
    return getAllSettings();
  });
}

export async function getSettingsAction() {
  return safeRun(async () => {
    await requireUser();
    return getAllSettings();
  });
}
