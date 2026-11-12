import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { issueEvents, issues, projects, type Sprint } from "@/db/schema";
import { formatIssueKey } from "./issueKey";
import { eachDay, isWorkingDay, localDay, ymd } from "./sprint";

export type BurndownPoint = {
  date: string;
  ideal: number;
  actual: number | null; // null for future days
  scopeAdded: number;
  added: { key: string; title: string; points: number }[];
};

export type Burndown = {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  today: string;
  startTotal: number;
  scopeAddedTotal: number;
  points: BurndownPoint[];
};

export function getBurndown(sprint: Sprint, now: Date): Burndown {
  const rows = db
    .select({ issue: issues, projectKey: projects.key })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.sprintId, sprint.id))
    .all();
  const events = rows.length
    ? db
        .select()
        .from(issueEvents)
        .where(
          and(
            inArray(
              issueEvents.issueId,
              rows.map((r) => r.issue.id),
            ),
            inArray(issueEvents.field, ["status", "sprintId"]),
          ),
        )
        .orderBy(asc(issueEvents.createdAt), asc(issueEvents.id))
        .all()
    : [];

  const days = eachDay(sprint.startDate, sprint.endDate);
  const today = ymd(now);

  const tracked = rows.map(({ issue, projectKey }) => {
    const own = events.filter((e) => e.issueId === issue.id);
    const statusEvents = own
      .filter((e) => e.field === "status")
      .map((e) => ({ day: localDay(e.createdAt), from: e.fromValue, to: e.toValue }));
    const joined = own.filter((e) => e.field === "sprintId" && e.toValue === String(sprint.id)).at(-1);
    const joinDay = joined ? localDay(joined.createdAt) : localDay(issue.createdAt);
    const statusOn = (day: string) => {
      const last = statusEvents.filter((e) => e.day <= day).at(-1);
      if (last) return last.to;
      return statusEvents[0]?.from ?? issue.status;
    };
    return {
      key: formatIssueKey(projectKey, issue.number),
      title: issue.title,
      points: issue.points,
      joinDay: joinDay < sprint.startDate ? sprint.startDate : joinDay,
      statusOn,
    };
  });

  const startTotal = tracked.filter((t) => t.joinDay === sprint.startDate).reduce((s, t) => s + t.points, 0);
  // Ideal burns only on working days, ending at 0 on the last day.
  const burnDays = days.slice(1).filter(isWorkingDay).length;
  let burned = 0;

  const points = days.map((date, i) => {
    if (i > 0 && isWorkingDay(date)) burned++;
    const inScope = tracked.filter((t) => t.joinDay <= date);
    const added = i > 0 ? tracked.filter((t) => t.joinDay === date) : [];
    const scope = inScope.reduce((s, t) => s + t.points, 0);
    const done = inScope.filter((t) => t.statusOn(date) === "done").reduce((s, t) => s + t.points, 0);
    return {
      date,
      ideal: burnDays ? Math.round(startTotal * (1 - burned / burnDays) * 10) / 10 : 0,
      actual: date <= today ? scope - done : null,
      scopeAdded: added.reduce((s, t) => s + t.points, 0),
      added: added.map(({ key, title, points }) => ({ key, title, points })),
    };
  });

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    today,
    startTotal,
    scopeAddedTotal: points.reduce((s, p) => s + p.scopeAdded, 0),
    points,
  };
}
