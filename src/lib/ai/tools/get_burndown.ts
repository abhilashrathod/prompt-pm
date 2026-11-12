import { z } from "zod";
import { getBurndown } from "@/lib/domain/burndown";
import { defineTool } from "./types";
import { isResult, ok, oneSprint, projectKey, sprintRef } from "./shared";

export const getBurndownTool = defineTool({
  name: "get_burndown",
  description: "Burndown chart for a sprint (ideal vs actual remaining points, scope added). Defaults to the current sprint.",
  kind: "read",
  schema: z.object({ sprint: sprintRef.default("current"), project: projectKey.optional() }),
  handler({ sprint: ref, project }, ctx) {
    const sprint = oneSprint(ref, project, ctx);
    if (isResult(sprint)) return sprint;
    const b = getBurndown(sprint, ctx.now);
    const todayPoint = b.points.filter((p) => p.actual != null).at(-1);
    return ok(
      {
        sprint: b.sprintName,
        startTotal: b.startTotal,
        scopeAdded: b.scopeAddedTotal,
        remainingToday: todayPoint?.actual ?? null,
        idealToday: todayPoint?.ideal ?? null,
        behindIdeal: todayPoint?.actual != null ? todayPoint.actual > todayPoint.ideal : null,
        endDate: b.endDate,
      },
      { type: "BurndownChart", props: b },
    );
  },
});
