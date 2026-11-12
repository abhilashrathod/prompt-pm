import { and, asc, eq } from "drizzle-orm";
import { differenceInCalendarDays, eachDayOfInterval, format, isWeekend, parseISO } from "date-fns";
import { db } from "@/db/client";
import { issues, projects, sprints, type Sprint } from "@/db/schema";

// All day math uses local "yyyy-MM-dd" strings, which compare correctly as text.
export const ymd = (d: Date) => format(d, "yyyy-MM-dd");
export const localDay = (isoTimestamp: string) => ymd(new Date(isoTimestamp));

export function eachDay(start: string, end: string): string[] {
  if (end < start) return [];
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(ymd);
}

export const isWorkingDay = (day: string) => !isWeekend(parseISO(day));

/** Inclusive count of Mon–Fri days. */
export function workingDays(start: string, end: string): number {
  return eachDay(start, end).filter(isWorkingDay).length;
}

export function overlapWorkingDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  return workingDays(aStart > bStart ? aStart : bStart, aEnd < bEnd ? aEnd : bEnd);
}

export function getSprint(id: number): Sprint | undefined {
  return db.select().from(sprints).where(eq(sprints.id, id)).get();
}

export function getActiveSprints(projectId?: number): Sprint[] {
  return db
    .select()
    .from(sprints)
    .where(and(eq(sprints.status, "active"), projectId ? eq(sprints.projectId, projectId) : undefined))
    .orderBy(asc(sprints.projectId))
    .all();
}

export function getActiveSprint(projectId: number): Sprint | undefined {
  return getActiveSprints(projectId)[0];
}

/** "current" (or nothing) → active sprint(s), optionally for one project; a number → that sprint. */
export function resolveSprints(ref: "current" | number | undefined, projectId?: number): Sprint[] {
  if (typeof ref === "number") {
    const s = getSprint(ref);
    return s ? [s] : [];
  }
  return getActiveSprints(projectId);
}

export type SprintSummary = {
  id: number;
  name: string;
  projectKey: string;
  status: Sprint["status"];
  startDate: string;
  endDate: string;
  daysLeft: number;
  workingDaysLeft: number;
  totalIssues: number;
  doneIssues: number;
  totalPoints: number;
  donePoints: number;
};

export function getSprintSummary(sprint: Sprint, now: Date): SprintSummary {
  const project = db.select().from(projects).where(eq(projects.id, sprint.projectId)).get();
  const rows = db
    .select({ status: issues.status, points: issues.points })
    .from(issues)
    .where(eq(issues.sprintId, sprint.id))
    .all();
  const done = rows.filter((r) => r.status === "done");
  const today = ymd(now);
  return {
    id: sprint.id,
    name: sprint.name,
    projectKey: project?.key ?? "",
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    daysLeft: Math.max(0, differenceInCalendarDays(parseISO(sprint.endDate), parseISO(today))),
    workingDaysLeft: workingDays(today > sprint.startDate ? today : sprint.startDate, sprint.endDate),
    totalIssues: rows.length,
    doneIssues: done.length,
    totalPoints: rows.reduce((s, r) => s + r.points, 0),
    donePoints: done.reduce((s, r) => s + r.points, 0),
  };
}
