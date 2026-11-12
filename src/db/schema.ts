import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const ROLES = ["member", "lead"] as const;
export const SPRINT_STATUSES = ["planned", "active", "closed"] as const;
export const ISSUE_TYPES = ["story", "bug", "task"] as const;
export const ISSUE_STATUSES = ["backlog", "todo", "in_progress", "qa", "done"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const ACTION_STATUSES = ["proposed", "confirmed", "undone", "expired"] as const;

export type Role = (typeof ROLES)[number];
export type SprintStatus = (typeof SPRINT_STATUSES)[number];
export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];

const id = () => integer("id").primaryKey({ autoIncrement: true });

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role", { enum: ROLES }).notNull(),
  capacityPointsPerSprint: integer("capacity_points_per_sprint").notNull(),
});

export const projects = sqliteTable("projects", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
});

export const sprints = sqliteTable(
  "sprints",
  {
    id: id(),
    projectId: integer("project_id").notNull().references(() => projects.id),
    name: text("name").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    status: text("status", { enum: SPRINT_STATUSES }).notNull(),
  },
  (t) => [index("sprints_project_idx").on(t.projectId)],
);

export const issues = sqliteTable(
  "issues",
  {
    id: id(),
    projectId: integer("project_id").notNull().references(() => projects.id),
    number: integer("number").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: ISSUE_TYPES }).notNull(),
    status: text("status", { enum: ISSUE_STATUSES }).notNull(),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    points: integer("points").notNull().default(0),
    assigneeId: integer("assignee_id").references(() => users.id),
    sprintId: integer("sprint_id").references(() => sprints.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("issues_sprint_idx").on(t.sprintId),
    index("issues_assignee_idx").on(t.assigneeId),
    index("issues_project_idx").on(t.projectId),
  ],
);

export const timeOff = sqliteTable(
  "time_off",
  {
    id: id(),
    userId: integer("user_id").notNull().references(() => users.id),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
  },
  (t) => [index("time_off_user_idx").on(t.userId)],
);

export const actions = sqliteTable("actions", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  toolName: text("tool_name").notNull(),
  args: text("args", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status", { enum: ACTION_STATUSES }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const issueEvents = sqliteTable(
  "issue_events",
  {
    id: id(),
    issueId: integer("issue_id").notNull().references(() => issues.id),
    actorId: integer("actor_id").notNull().references(() => users.id),
    field: text("field").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    actionId: integer("action_id").references(() => actions.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("issue_events_issue_idx").on(t.issueId), index("issue_events_action_idx").on(t.actionId)],
);

export const commandLog = sqliteTable("command_log", {
  id: id(),
  userId: integer("user_id").notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  toolsCalled: text("tools_called", { mode: "json" }).$type<string[]>().notNull(),
  latencyMs: integer("latency_ms").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type IssueEvent = typeof issueEvents.$inferSelect;
export type CommandLogRow = typeof commandLog.$inferSelect;
