import { and, asc, desc, eq, inArray, isNull, like } from "drizzle-orm";
import { db } from "@/db/client";
import {
  issueEvents,
  issues,
  projects,
  sprints,
  users,
  type Issue,
  type IssueStatus,
  type IssueType,
  type Priority,
  type Project,
} from "@/db/schema";
import { findIssueByKey, formatIssueKey, type IssueWithKey } from "./issueKey";

export type IssueListItem = Pick<
  Issue,
  "id" | "number" | "title" | "type" | "status" | "priority" | "points" | "assigneeId" | "sprintId"
> & { key: string; projectKey: string; assigneeName: string | null };

export type IssueFilters = {
  projectId?: number;
  sprintIds?: number[];
  backlogOnly?: boolean;
  assigneeId?: number;
  status?: IssueStatus;
  type?: IssueType;
  priority?: Priority;
  text?: string;
  limit?: number;
};

export function listProjects(): Project[] {
  return db.select().from(projects).orderBy(asc(projects.id)).all();
}

export function listIssues(f: IssueFilters): IssueListItem[] {
  const q = db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      type: issues.type,
      status: issues.status,
      priority: issues.priority,
      points: issues.points,
      assigneeId: issues.assigneeId,
      sprintId: issues.sprintId,
      projectKey: projects.key,
      assigneeName: users.name,
    })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .leftJoin(users, eq(issues.assigneeId, users.id))
    .where(
      and(
        f.projectId ? eq(issues.projectId, f.projectId) : undefined,
        f.sprintIds ? inArray(issues.sprintId, f.sprintIds) : undefined,
        f.backlogOnly ? isNull(issues.sprintId) : undefined,
        f.assigneeId ? eq(issues.assigneeId, f.assigneeId) : undefined,
        f.status ? eq(issues.status, f.status) : undefined,
        f.type ? eq(issues.type, f.type) : undefined,
        f.priority ? eq(issues.priority, f.priority) : undefined,
        f.text ? like(issues.title, `%${f.text}%`) : undefined,
      ),
    )
    .orderBy(asc(issues.number));
  const rows = f.limit ? q.limit(f.limit).all() : q.all();
  return rows.map((r) => ({ ...r, key: formatIssueKey(r.projectKey, r.number) }));
}

export type EventView = {
  id: number;
  actorName: string;
  field: string;
  from: string | null;
  to: string | null;
  createdAt: string;
};

/** Latest events with ids turned into names (assignee, sprint) for display. */
export function getRecentEvents(issueId: number, limit: number): EventView[] {
  const rows = db
    .select({ event: issueEvents, actorName: users.name })
    .from(issueEvents)
    .innerJoin(users, eq(issueEvents.actorId, users.id))
    .where(eq(issueEvents.issueId, issueId))
    .orderBy(desc(issueEvents.createdAt), desc(issueEvents.id))
    .limit(limit)
    .all();
  const userNames = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [String(u.id), u.name]));
  const sprintNames = new Map(db.select({ id: sprints.id, name: sprints.name }).from(sprints).all().map((s) => [String(s.id), s.name]));
  const label = (field: string, v: string | null) =>
    v == null ? null : field === "assigneeId" ? (userNames.get(v) ?? v) : field === "sprintId" ? (sprintNames.get(v) ?? v) : v;
  return rows.map(({ event: e, actorName }) => ({
    id: e.id,
    actorName,
    field: e.field,
    from: label(e.field, e.fromValue),
    to: label(e.field, e.toValue),
    createdAt: e.createdAt,
  }));
}

export type IssueDetail = IssueWithKey & { assigneeName: string | null; sprintName: string | null; events: EventView[] };

export function getIssueDetail(key: string, eventLimit: number): IssueDetail | null {
  const issue = findIssueByKey(key);
  if (!issue) return null;
  const assignee = issue.assigneeId ? db.select().from(users).where(eq(users.id, issue.assigneeId)).get() : undefined;
  const sprint = issue.sprintId ? db.select().from(sprints).where(eq(sprints.id, issue.sprintId)).get() : undefined;
  return {
    ...issue,
    assigneeName: assignee?.name ?? null,
    sprintName: sprint?.name ?? null,
    events: getRecentEvents(issue.id, eventLimit),
  };
}
