"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { issues, users } from "@/db/schema";
import { USER_COOKIE } from "@/lib/domain/currentUser";
import { applyIssuePatch, checkPatchPermission, issuePatchSchema } from "@/lib/domain/events";
import { getCurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function switchUser(userId: number): Promise<void> {
  if (!db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()) return;
  (await cookies()).set(USER_COOKIE, String(userId), { path: "/", httpOnly: true, sameSite: "lax" });
}

/** Issue drawer edits. Same write path as confirmed agent actions, without a proposal step. */
export async function updateIssue(issueId: number, rawPatch: unknown): Promise<ActionResult> {
  const parsed = issuePatchSchema.safeParse(rawPatch);
  if (!parsed.success) return { ok: false, error: "Invalid change." };
  const user = await getCurrentUser();
  const issue = db.select().from(issues).where(eq(issues.id, issueId)).get();
  if (!issue) return { ok: false, error: "Issue not found." };
  const denied = checkPatchPermission(user, issue, parsed.data);
  if (denied) return { ok: false, error: denied };
  try {
    db.transaction((tx) => applyIssuePatch(tx, issueId, parsed.data, { actorId: user.id, now: new Date() }));
  } catch {
    return { ok: false, error: "Could not save the change." };
  }
  revalidatePath("/");
  return { ok: true };
}
