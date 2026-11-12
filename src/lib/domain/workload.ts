import { and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, timeOff, users, type Sprint } from "@/db/schema";
import { overlapWorkingDays, workingDays } from "./sprint";

export type WorkloadRow = {
  userId: number;
  name: string;
  capacity: number;
  workingDays: number;
  daysOff: number;
  effectiveCapacity: number;
  remainingPoints: number;
  loadPct: number;
  overloaded: boolean;
};

/**
 * Capacity is per person per sprint cycle, so across several sprints (e.g. both projects' current
 * sprints) remaining points are summed and capacity is counted once over the combined date span.
 */
export function getWorkload(sprintList: Sprint[], userIds?: number[]): WorkloadRow[] {
  if (!sprintList.length) return [];
  const start = sprintList.reduce((m, s) => (s.startDate < m ? s.startDate : m), sprintList[0].startDate);
  const end = sprintList.reduce((m, s) => (s.endDate > m ? s.endDate : m), sprintList[0].endDate);
  const wd = workingDays(start, end);

  const people = db
    .select()
    .from(users)
    .where(userIds?.length ? inArray(users.id, userIds) : undefined)
    .all();
  const ids = people.map((u) => u.id);

  const remaining = new Map(
    db
      .select({ userId: issues.assigneeId, points: sql<number>`coalesce(sum(${issues.points}), 0)` })
      .from(issues)
      .where(
        and(
          inArray(
            issues.sprintId,
            sprintList.map((s) => s.id),
          ),
          ne(issues.status, "done"),
          inArray(issues.assigneeId, ids),
        ),
      )
      .groupBy(issues.assigneeId)
      .all()
      .map((r) => [r.userId, r.points]),
  );

  const daysOff = new Map<number, number>();
  for (const t of db.select().from(timeOff).where(inArray(timeOff.userId, ids)).all()) {
    daysOff.set(t.userId, (daysOff.get(t.userId) ?? 0) + overlapWorkingDays(t.startDate, t.endDate, start, end));
  }

  return people.map((u) => {
    const off = Math.min(wd, daysOff.get(u.id) ?? 0);
    const effective = wd ? (u.capacityPointsPerSprint * (wd - off)) / wd : 0;
    const rem = remaining.get(u.id) ?? 0;
    // Zero capacity with work left is "maximally" overloaded; avoid Infinity in JSON.
    const loadPct = effective > 0 ? Math.round((rem / effective) * 100) : rem > 0 ? 999 : 0;
    return {
      userId: u.id,
      name: u.name,
      capacity: u.capacityPointsPerSprint,
      workingDays: wd,
      daysOff: off,
      effectiveCapacity: Math.round(effective * 10) / 10,
      remainingPoints: rem,
      loadPct,
      overloaded: loadPct > 100,
    };
  });
}
