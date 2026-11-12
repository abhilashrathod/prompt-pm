import { addDays, addHours, format, isWeekend, startOfDay, subDays } from "date-fns";
import { db } from "./client";
import {
  actions,
  commandLog,
  issueEvents,
  issues,
  projects,
  sprints,
  timeOff,
  users,
  type IssueStatus,
  type IssueType,
  type Priority,
} from "./schema";

// ---------- deterministic random ----------
let state = 42;
function rand() {
  // mulberry32
  state = (state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
function weighted<T>(items: readonly T[], weights: readonly number[]): T {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
  return items[items.length - 1];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- fixtures ----------
const TYPE_BY_PREFIX: Record<string, IssueType> = { s: "story", b: "bug", t: "task" };

const PPM_TITLES = `s Board columns show WIP count per status
s Issue drawer shows last 10 activity events
b Fix avatar fallback initials for single-word names
s Add keyboard shortcut to focus prompt bar
t Upgrade Tailwind config and remove legacy plugins
b Fix sprint progress bar overflowing past 100%
s Show days left in sprint header
b Fix flicker when switching projects
s Priority badge colors match design tokens
t Extract IssueCard into a shared component
b Fix drawer closing when selecting an assignee
s Empty state for board with no active sprint
s Add issue type icons to cards
b Fix timezone shift in sprint end date
t Add loading skeletons for board columns
s Command log table with latency column
b Fix Cmd+K not focusing input in Firefox
s Autocomplete issue keys after typing #
t Audit color contrast on status pills
b Fix long titles breaking card layout
s Burndown tooltip shows scope changes
s Workload strip highlights overloaded people
b Fix undo button staying enabled after expiry
t Remove unused icons from the UI kit
s Confirm card shows before and after values
b Fix scroll jump when a new chat message arrives
s User switcher in header
t Write copy for empty chat suggestions
b Fix points total rounding in table footer
s Clicking a table row opens the issue drawer
t Set up Sheet and Select components
b Fix focus ring missing on prompt input
s Project tabs filter the board
t Add favicon and app metadata
b Fix double submit on Enter with IME input
s Collapsible steps line under assistant reply
t Clean up unused CSS variables
s Show assignee availability on avatar hover
b Fix sprint selector listing closed sprints
s Remember last selected project
t Document keyboard shortcuts in help popover
b Fix escaping in assistant reply text
s Dark mode for board and chat`;

const API_TITLES = `s Endpoint to list issues by sprint and assignee
b Fix 500 when issue key has lowercase prefix
s Resolve "me" to the current user server-side
t Add index on issues.sprint_id
b Fix off-by-one in working days calculation
s Burndown endpoint returns ideal and actual series
s Workload endpoint with effective capacity
t Validate tool args with zod before execution
b Fix race when confirming the same action twice
s Expire proposed actions after 10 minutes
s Undo reverts events in reverse order
t Log token usage per command
b Fix null assignee crashing workload query
s Fuzzy user search with score threshold
t Cap bulk updates at 20 issues
b Fix project-prefixed keys not resolving
s Permission check for reassigning others' issues
t Move OpenRouter headers into client factory
b Fix time off overlapping sprint boundaries
s Issue search endpoint for autocomplete
t Add request timeout to model calls
b Fix duplicate events when a patch has no changes
s Create issue with next global number
t Seed script with fixed random seed
b Fix "current" sprint resolving across projects
s Return compact tool results to the model
t Enable WAL mode on SQLite connection
b Fix wrong load % when capacity is zero
s Command log stores tool call sequence
t Rate limit chat endpoint per user
b Fix parsing of date-only strings
s Clarify response when two users match
t Add p95 latency query for log page
b Fix scope-added issues hidden in burndown
s Sprint summary with done and total points
t Retry model call once on 429
b Fix rollback on partially applied confirm
s Status transition events for audit trail
t Document tool schemas in README
b Fix unassigned issues missing from list filter
s Model price table for cost estimates`;

const parseTitles = (src: string) =>
  src.split("\n").map((line) => ({ type: TYPE_BY_PREFIX[line[0]], title: line.slice(2) }));

const DESCRIPTIONS: Record<IssueType, string> = {
  story: "As a user I want this so the team can see and act on sprint work faster. Acceptance criteria agreed in refinement.",
  bug: "Steps to reproduce are in the linked thread. Expected behaviour differs from actual; fix and add a regression check in review.",
  task: "Internal engineering task. No user-facing change expected.",
};

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const PRIORITY_W = [0.2, 0.45, 0.25, 0.1];
const POINTS = [1, 2, 3, 5, 8];
const POINTS_W = [0.15, 0.3, 0.3, 0.18, 0.07];

const ABHI = 1;
const PRIYA_KUMAR = 3;
const USER_IDS = [1, 2, 3, 4];

// ---------- dates ----------
const now = new Date();
const today = startOfDay(now);
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const closedStart = subDays(today, 28);
const closedEnd = subDays(today, 14);
const activeStart = subDays(today, 6);
const activeEnd = addDays(today, 8);

// ---------- build ----------
type IssueRow = typeof issues.$inferInsert;
type EventRow = typeof issueEvents.$inferInsert;

const issueRows: IssueRow[] = [];
const eventRows: EventRow[] = [];
let nextNumber = 4500;

function makeIssue(
  projectId: number,
  t: { type: IssueType; title: string },
  sprintId: number | null,
  status: IssueStatus,
  createdAt: Date,
  assigneeId: number | null,
): IssueRow {
  const row: IssueRow = {
    id: issueRows.length + 1,
    projectId,
    number: nextNumber++,
    title: t.title,
    description: DESCRIPTIONS[t.type],
    type: t.type,
    status,
    priority: weighted(PRIORITIES, PRIORITY_W),
    points: weighted(POINTS, POINTS_W),
    assigneeId,
    sprintId,
    createdAt: iso(createdAt),
    updatedAt: iso(createdAt),
  };
  issueRows.push(row);
  return row;
}

const FLOW: IssueStatus[] = ["todo", "in_progress", "qa", "done"];
const STEP_HOURS = [10, 13, 16];

/** Write todo → … → `status` events. `days` are sprint-day offsets for each step, non-decreasing. */
function addStatusEvents(issue: IssueRow, sprintStart: Date, days: number[]) {
  let last = issue.createdAt;
  days.forEach((day, i) => {
    const planned = addHours(addDays(sprintStart, day), STEP_HOURS[i]);
    // Never in the future; clamped values stay ordered.
    const at = new Date(Math.min(planned.getTime(), now.getTime() - (3 - i) * 10 * 60_000));
    last = iso(at);
    eventRows.push({
      issueId: issue.id!,
      actorId: issue.assigneeId ?? ABHI,
      field: "status",
      fromValue: FLOW[i],
      toValue: FLOW[i + 1],
      createdAt: last,
    });
  });
  issue.updatedAt = last;
}

/** Non-decreasing day offsets ending at `lastDay`, `steps` long. */
function stepDays(lastDay: number, steps: number): number[] {
  const days = [lastDay];
  while (days.length < steps) days.unshift(Math.max(0, days[0] - int(0, 2)));
  return days;
}

const pickAssignee = (unassignedChance: number) => (rand() < unassignedChance ? null : USER_IDS[int(0, 3)]);

const projectDefs = [
  { id: 1, key: "PPM", name: "PromptPM Web", titles: shuffle(parseTitles(PPM_TITLES)), active: 21, closed: 12, backlog: 8 },
  { id: 2, key: "API", name: "PromptPM API", titles: shuffle(parseTitles(API_TITLES)), active: 20, closed: 12, backlog: 7 },
];

const sprintRows: (typeof sprints.$inferInsert)[] = [];

for (const p of projectDefs) {
  const closedId = sprintRows.length + 1;
  const activeId = closedId + 1;
  sprintRows.push(
    { id: closedId, projectId: p.id, name: `${p.key} Sprint 1`, startDate: ymd(closedStart), endDate: ymd(closedEnd), status: "closed" },
    { id: activeId, projectId: p.id, name: `${p.key} Sprint 2`, startDate: ymd(activeStart), endDate: ymd(activeEnd), status: "active" },
  );
  const titles = [...p.titles];

  // Active sprint: statuses by cumulative points (~40% done, then qa, in progress, todo).
  // PPM gets the two mid-sprint additions as its last two active issues.
  const addedCount = p.key === "PPM" ? 2 : 0;
  const baseActive = Array.from({ length: p.active - addedCount }, () =>
    makeIssue(p.id, titles.shift()!, activeId, "todo", subDays(activeStart, int(1, 14)), null),
  );
  if (p.key === "PPM") {
    // Pin #4512 as Abhi's in-progress issue for the "Move #4512 to QA" chip.
    const pinned = baseActive.find((i) => i.number === 4512)!;
    pinned.assigneeId = ABHI;
    pinned.points = 3;
  }
  const total = baseActive.reduce((s, i) => s + i.points!, 0);
  let acc = 0;
  for (const issue of shuffle(baseActive)) {
    const share = acc / total;
    acc += issue.points!;
    let status: IssueStatus = share < 0.4 ? "done" : share < 0.55 ? "qa" : share < 0.8 ? "in_progress" : "todo";
    if (issue.number === 4512) status = "in_progress";
    issue.status = status;
    if (status !== "todo" && issue.assigneeId == null) issue.assigneeId = USER_IDS[int(0, 3)];
    if (status === "todo" && issue.number !== 4512) issue.assigneeId = pickAssignee(0.25);
    const steps = FLOW.indexOf(status);
    if (steps > 0) addStatusEvents(issue, activeStart, stepDays(int(steps === 3 ? 1 : 2, 6), steps));
  }

  for (let k = 0; k < addedCount; k++) {
    const createdAt = addHours(subDays(today, 3 - k), 11 + k * 3);
    const issue = makeIssue(p.id, titles.shift()!, activeId, "todo", createdAt, k === 0 ? PRIYA_KUMAR : 2);
    eventRows.push({ issueId: issue.id!, actorId: ABHI, field: "sprintId", fromValue: null, toValue: String(activeId), createdAt: iso(createdAt) });
    if (k === 0) {
      issue.status = "in_progress";
      addStatusEvents(issue, activeStart, [5]);
    }
  }

  // Closed sprint: everything done inside the sprint window.
  for (let k = 0; k < p.closed; k++) {
    const issue = makeIssue(p.id, titles.shift()!, closedId, "done", subDays(closedStart, int(1, 10)), USER_IDS[int(0, 3)]);
    addStatusEvents(issue, closedStart, stepDays(int(2, 13), 3));
  }

  // Backlog: no sprint, half unassigned.
  for (let k = 0; k < p.backlog; k++) {
    makeIssue(p.id, titles.shift()!, null, "backlog", subDays(today, int(1, 40)), pickAssignee(0.5));
  }
}

// Priya Kumar: three working days off inside the active sprint, starting the day after tomorrow.
const offDays: Date[] = [];
for (let d = addDays(today, 2); offDays.length < 3; d = addDays(d, 1)) if (!isWeekend(d)) offDays.push(d);

// ---------- write ----------
db.transaction((tx) => {
  for (const t of [commandLog, issueEvents, actions, timeOff, issues, sprints, projects, users]) tx.delete(t).run();

  tx.insert(users)
    .values([
      { id: 1, name: "Abhi", handle: "abhi", role: "lead", capacityPointsPerSprint: 24 },
      { id: 2, name: "Priya Shah", handle: "priya.shah", role: "member", capacityPointsPerSprint: 26 },
      { id: 3, name: "Priya Kumar", handle: "priya.kumar", role: "member", capacityPointsPerSprint: 20 },
      { id: 4, name: "Rohan Mehta", handle: "rohan", role: "member", capacityPointsPerSprint: 30 },
    ])
    .run();
  tx.insert(projects).values(projectDefs.map(({ id, key, name }) => ({ id, key, name }))).run();
  tx.insert(sprints).values(sprintRows).run();
  tx.insert(issues).values(issueRows).run();
  tx.insert(issueEvents).values(eventRows).run();
  tx.insert(timeOff).values({ userId: PRIYA_KUMAR, startDate: ymd(offDays[0]), endDate: ymd(offDays[2]) }).run();
});

// ---------- summary ----------
const active = issueRows.filter((i) => i.sprintId === 2 || i.sprintId === 4);
const pts = (rows: IssueRow[]) => rows.reduce((s, i) => s + i.points!, 0);
const remaining = USER_IDS.map((u) => pts(active.filter((i) => i.assigneeId === u && i.status !== "done")));
console.log(
  `Seeded ${issueRows.length} issues (#4500–#${nextNumber - 1}), ${eventRows.length} events. ` +
    `Active done: ${Math.round((pts(active.filter((i) => i.status === "done")) / pts(active)) * 100)}% of points. ` +
    `Remaining pts Abhi/PriyaS/PriyaK/Rohan: ${remaining.join("/")}.`,
);
