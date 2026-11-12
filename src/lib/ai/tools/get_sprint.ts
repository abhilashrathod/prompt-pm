import { z } from "zod";
import { getSprintSummary } from "@/lib/domain/sprint";
import { defineTool } from "./types";
import { isResult, ok, oneSprint, projectKey, sprintRef } from "./shared";

export const getSprint = defineTool({
  name: "get_sprint",
  description: "Sprint dates, days left and points done vs total. Defaults to the current sprint.",
  kind: "read",
  schema: z.object({ id: sprintRef.optional().describe('"current" or a sprint id'), project: projectKey.optional() }),
  handler({ id, project }, ctx) {
    const sprint = oneSprint(id, project, ctx);
    if (isResult(sprint)) return sprint;
    const s = getSprintSummary(sprint, ctx.now);
    return ok(
      {
        name: s.name,
        project: s.projectKey,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        daysLeft: s.daysLeft,
        donePoints: s.donePoints,
        totalPoints: s.totalPoints,
        doneIssues: s.doneIssues,
        totalIssues: s.totalIssues,
      },
      { type: "SprintSummary", props: s },
    );
  },
});
