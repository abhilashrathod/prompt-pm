import { z } from "zod";
import { getIssueDetail } from "@/lib/domain/issues";
import { defineTool } from "./types";
import { fail, ok } from "./shared";

export const getIssue = defineTool({
  name: "get_issue",
  description: 'Get one issue with its recent activity. Key can be "#4512", "4512" or "PPM-4512".',
  kind: "read",
  schema: z.object({ key: z.coerce.string().trim().min(1) }),
  handler({ key }) {
    const issue = getIssueDetail(key, 5);
    if (!issue) return fail(`No issue matches "${key}".`);
    return ok(
      {
        key: issue.key,
        title: issue.title,
        type: issue.type,
        status: issue.status,
        priority: issue.priority,
        points: issue.points,
        assignee: issue.assigneeName,
        sprint: issue.sprintName,
        recentActivity: issue.events.map((e) => `${e.actorName}: ${e.field} ${e.from ?? "none"} → ${e.to ?? "none"}`),
      },
      { type: "IssueCard", props: issue },
    );
  },
});
