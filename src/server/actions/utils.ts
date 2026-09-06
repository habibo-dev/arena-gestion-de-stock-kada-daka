import "server-only";
import { z } from "zod";
import { AuthError, PermissionError } from "@/server/auth/session";
import { BusinessError, fail, ok, type ActionResult } from "@/lib/result";

/**
 * Wrap a server-action body: validates input with the given schema, converts
 * known error types to user-facing messages and never leaks stack traces.
 */
export async function runAction<S extends z.ZodTypeAny, R>(
  schema: S,
  rawInput: unknown,
  body: (input: z.output<S>) => Promise<R> | R,
): Promise<ActionResult<R>> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(flat.fieldErrors)) {
      if (Array.isArray(v) && v.length) fieldErrors[k] = v as string[];
    }
    const first = Object.values(fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Données invalides.";
    return fail(first, fieldErrors);
  }
  return safeRun(() => body(parsed.data));
}

export async function safeRun<R>(body: () => Promise<R> | R): Promise<ActionResult<R>> {
  try {
    return ok(await body());
  } catch (err) {
    if (err instanceof BusinessError || err instanceof AuthError || err instanceof PermissionError) {
      return fail(err.message);
    }
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      return fail("Cette valeur existe déjà (contrainte d'unicité).");
    }
    if (err instanceof Error && /FOREIGN KEY constraint failed/i.test(err.message)) {
      return fail("Opération impossible : cet élément est utilisé ailleurs dans l'application.");
    }
    console.error("[action] unexpected error", err);
    return fail("Une erreur inattendue s'est produite. Veuillez réessayer.");
  }
}
