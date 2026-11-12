import { z } from "zod";
import { getWorkload } from "@/lib/domain/workload";
import { defineTool } from "./types";
import { fail, ok, projectKey, resolveUser, sprintRef, sprintsFor, userRef } from "./shared";

export const getWorkloadTool = defineTool({
  name: "get_workload",
  description:
    "Remaining points vs effective capacity (after time off) per person for the current sprint(s). " +
    "Load over 100% means overloaded. Omit userIds for the whole team; use find_user to get ids.",
  kind: "read",
  schema: z.object({
    userIds: z.array(userRef).optional().describe('User ids, or "me"'),
    sprint: sprintRef.optional(),
    project: projectKey.optional(),
  }),
  handler({ userIds, sprint, project }, ctx) {
    const ids: number[] = [];
    for (const ref of userIds ?? []) {
      const u = resolveUser(ref, ctx);
      if (!u) return fail(`No user with id ${ref}.`);
      ids.push(u.id);
    }
    const found = sprintsFor(sprint, project);
    if (!Array.isArray(found)) return found;
    if (!found.length) return fail("No matching sprint.");

    const rows = getWorkload(found, ids.length ? ids : undefined);
    const title = `Workload · ${found.length > 1 ? "current sprints" : found[0].name}`;
    return ok(
      {
        sprints: found.map((s) => s.name),
        people: rows.map((r) => ({
          id: r.userId,
          name: r.name,
          remainingPoints: r.remainingPoints,
          effectiveCapacity: r.effectiveCapacity,
          loadPct: r.loadPct,
          daysOff: r.daysOff,
          overloaded: r.overloaded,
        })),
      },
      { type: "WorkloadStrip", props: { title, rows } },
    );
  },
});
