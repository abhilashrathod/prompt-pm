import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Conn } from "@/db/client";
import { ISSUE_STATUSES, PRIORITIES, issueEvents, issues, type Issue, type User } from "@/db/schema";

export const PATCH_FIELDS = ["status", "assigneeId", "priority", "points", "sprintId", "title"] as const;
export type PatchField = (typeof PATCH_FIELDS)[number];
export type IssuePatch = Partial<Pick<Issue, PatchField>>;
export type FieldChange = { field: PatchField; from: string | null; to: string | null };

export const issuePatchSchema = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    points: z.number().int().min(0).max(100).optional(),
    sprintId: z.number().int().positive().nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const NUMERIC_FIELDS = new Set<string>(["assigneeId", "points", "sprintId"]);

// issue_events stores values as text; these convert both ways.
export const encodeValue = (v: unknown): string | null => (v == null ? null : String(v));
export const decodeValue = (field: string, v: string | null): string | number | null =>
  v == null ? null : NUMERIC_FIELDS.has(field) ? Number(v) : v;

/** Fields in `patch` that actually change `issue`. Used for previews and for applying. */
export function diffPatch(issue: Issue, patch: IssuePatch): FieldChange[] {
  return PATCH_FIELDS.filter((f) => patch[f] !== undefined && patch[f] !== issue[f]).map((f) => ({
    field: f,
    from: encodeValue(issue[f]),
    to: encodeValue(patch[f]),
  }));
}

/**
 * Permission check for a patch. There is no project membership table, so every user is a member
 * of every project; the only rule left is that only leads reassign issues owned by someone else.
 */
export function checkPatchPermission(user: User, issue: Issue, patch: IssuePatch): string | null {
  const reassigning = patch.assigneeId !== undefined && patch.assigneeId !== issue.assigneeId;
  if (reassigning && user.role !== "lead" && issue.assigneeId != null && issue.assigneeId !== user.id) {
    return "Only leads can reassign issues owned by someone else.";
  }
  return null;
}

/**
 * The single write path for issue fields: updates the row and logs one event per changed field.
 * Pass a transaction when it's part of a larger unit (confirm, undo).
 */
export function applyIssuePatch(
  conn: Conn,
  issueId: number,
  patch: IssuePatch,
  opts: { actorId: number; now: Date; actionId?: number | null },
): FieldChange[] {
  const issue = conn.select().from(issues).where(eq(issues.id, issueId)).get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  const changes = diffPatch(issue, patch);
  if (!changes.length) return [];

  const at = opts.now.toISOString();
  const set = Object.fromEntries(changes.map((c) => [c.field, patch[c.field]])) as IssuePatch;
  conn.update(issues).set({ ...set, updatedAt: at }).where(eq(issues.id, issueId)).run();
  conn
    .insert(issueEvents)
    .values(
      changes.map((c) => ({
        issueId,
        actorId: opts.actorId,
        field: c.field,
        fromValue: c.from,
        toValue: c.to,
        actionId: opts.actionId ?? null,
        createdAt: at,
      })),
    )
    .run();
  return changes;
}
