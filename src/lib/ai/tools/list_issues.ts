import { z } from "zod";
import { ISSUE_STATUSES, ISSUE_TYPES, PRIORITIES } from "@/db/schema";
import { listIssues } from "@/lib/domain/issues";
import { STATUS_TEXT } from "./labels";
import { defineTool } from "./types";
import { fail, findProject, ok, projectKey, resolveUser, sprintRef, sprintsFor, userRef } from "./shared";

export const listIssuesTool = defineTool({
  name: "list_issues",
  description:
    "List issues with filters. For \"my tasks right now\" use assignee \"me\", sprint \"current\", status \"open\". " +
    "For other people, get their id from find_user first. Omit sprint to search all sprints and the backlog.",
  kind: "read",
  schema: z.object({
    assignee: userRef.optional().describe('"me" or a user id'),
    status: z.enum([...ISSUE_STATUSES, "open"]).optional().describe('"open" means anything not done'),
    sprint: sprintRef.optional().describe('"current" for the active sprint(s), or a sprint id'),
    project: projectKey.optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    text: z.string().trim().min(1).optional().describe("Words to match in the title"),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  }),
  handler(a, ctx) {
    const assignee = a.assignee !== undefined ? resolveUser(a.assignee, ctx) : undefined;
    if (a.assignee !== undefined && !assignee) return fail(`No user with id ${a.assignee}.`);

    const project = a.project ? findProject(a.project) : undefined;
    if (a.project && !project) return fail(`Unknown project "${a.project}".`);

    let sprintIds: number[] | undefined;
    let sprintLabel = "";
    if (a.sprint !== undefined) {
      const found = sprintsFor(a.sprint, a.project);
      if (!Array.isArray(found)) return found;
      if (!found.length) return fail("No matching sprint.");
      sprintIds = found.map((s) => s.id);
      sprintLabel = a.sprint === "current" ? "current sprint" : found[0].name;
    }

    const rows = listIssues({
      projectId: project?.id,
      sprintIds,
      assigneeId: assignee?.id,
      status: a.status === "open" ? undefined : a.status,
      openOnly: a.status === "open",
      type: a.type,
      priority: a.priority,
      text: a.text,
      limit: a.limit + 1,
    });
    const truncated = rows.length > a.limit;
    const shown = rows.slice(0, a.limit);
    const totalPoints = shown.reduce((s, i) => s + i.points, 0);

    const title =
      [
        assignee && (assignee.id === ctx.user.id ? "My issues" : `${assignee.name}'s issues`),
        project?.key,
        sprintLabel,
        a.status && STATUS_TEXT[a.status],
        a.type && `${a.type}s`,
        a.priority && `${a.priority} priority`,
        a.text && `“${a.text}”`,
      ]
        .filter(Boolean)
        .join(" · ") || "Issues";

    return ok(
      {
        count: shown.length,
        truncated,
        totalPoints,
        issues: shown.map((i) => ({
          key: i.key,
          title: i.title,
          status: i.status,
          priority: i.priority,
          points: i.points,
          assignee: i.assigneeName,
        })),
      },
      { type: "IssueTable", props: { title, issues: shown, totalPoints, truncated } },
    );
  },
});
