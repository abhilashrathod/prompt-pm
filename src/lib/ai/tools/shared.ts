import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, users, type Project, type Sprint, type User } from "@/db/schema";
import { resolveSprints } from "@/lib/domain/sprint";
import type { ToolCtx, ToolResult } from "./types";

export const ok = (data: unknown, block?: Extract<ToolResult, { ok: true }>["block"]): ToolResult => ({ ok: true, data, block });
export const fail = (error: string): ToolResult => ({ ok: false, error });

// Models sometimes send ids as strings; coerce them.
export const id = z.coerce.number().int().positive();
export const userRef = z.union([z.literal("me"), id]);
export const sprintRef = z.union([z.literal("current"), id]);
export const projectKey = z.string().trim().toUpperCase().describe('Project key, e.g. "PPM" or "API"');

export function findProject(key: string): Project | undefined {
  return db.select().from(projects).where(eq(projects.key, key.toUpperCase())).get();
}

export function resolveUser(ref: z.infer<typeof userRef>, ctx: ToolCtx): User | undefined {
  return ref === "me" ? ctx.user : db.select().from(users).where(eq(users.id, ref)).get();
}

/** Sprints for a ref; `project` narrows "current". Returns an error result for unknown projects. */
export function sprintsFor(ref: z.infer<typeof sprintRef> | undefined, project: string | undefined): Sprint[] | ToolResult {
  let projectId: number | undefined;
  if (project) {
    const p = findProject(project);
    if (!p) return fail(`Unknown project "${project}".`);
    projectId = p.id;
  }
  return resolveSprints(ref ?? "current", projectId);
}

/**
 * Exactly one sprint. "current" with several projects falls back to the board tab the user is on;
 * if that is unknown, asks which project instead of guessing.
 */
export function oneSprint(ref: z.infer<typeof sprintRef> | undefined, project: string | undefined, ctx: ToolCtx): Sprint | ToolResult {
  const found = sprintsFor(ref, project ?? (ref === undefined || ref === "current" ? ctx.projectKey : undefined));
  if (!Array.isArray(found)) return found;
  if (found.length === 1) return found[0];
  if (!found.length) return fail("No matching sprint.");
  const keys = new Map(db.select().from(projects).all().map((p) => [p.id, p.key]));
  const options = found.map((s) => ({ label: s.name, value: `for project ${keys.get(s.projectId)}` }));
  return ok(
    { needsClarification: true, question: "Which project's sprint?", options: options.map((o) => o.label) },
    { type: "ClarifyChips", props: { question: "Which project's sprint?", options } },
  );
}

export const isResult = (x: unknown): x is ToolResult => typeof x === "object" && x !== null && "ok" in x;
