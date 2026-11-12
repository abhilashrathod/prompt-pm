import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, projects, type Issue } from "@/db/schema";

export type IssueWithKey = Issue & { key: string; projectKey: string };

// "#4512", "4512", "PPM-4512" (any case). Numbers are global, so the prefix is only a check.
const KEY_RE = /^\s*(?:#|([A-Za-z]+)-)?(\d+)\s*$/;

export function parseIssueKey(input: string): { projectKey: string | null; number: number } | null {
  const m = KEY_RE.exec(input);
  return m ? { projectKey: m[1]?.toUpperCase() ?? null, number: Number(m[2]) } : null;
}

export const formatIssueKey = (projectKey: string, number: number) => `${projectKey}-${number}`;

export function findIssueByKey(input: string): IssueWithKey | null {
  const parsed = parseIssueKey(input);
  if (!parsed) return null;
  const row = db
    .select({ issue: issues, projectKey: projects.key })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.number, parsed.number))
    .get();
  if (!row || (parsed.projectKey && parsed.projectKey !== row.projectKey)) return null;
  return { ...row.issue, projectKey: row.projectKey, key: formatIssueKey(row.projectKey, row.issue.number) };
}
