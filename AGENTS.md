# AGENTS.md — PromptPM

Instructions for coding agents working in this repo. Read this file fully before making changes.

## What this is

PromptPM is a small Jira/Trello-style project tracker whose main interface is a prompt bar.
Users type things like "what are my tasks right now", "move #4544 to QA", "show the burndown",
"show Priya's backlog and availability". The answer renders as real UI (tables, charts, confirm cards), not paragraphs.

The tracker underneath is deliberately thin. The engineering that matters:

1. **The model never touches the database.** It calls 8 typed tools; server code runs deterministic, permission-checked queries.
2. **Numbers on screen come from tool results, not model text.** UI blocks are built server-side from tool output. The model only writes a 1–2 sentence `text` line.
3. **Every write is confirmed and undoable.** Write tools only create a proposal; a separate route applies it; undo reverts it.
4. **"Me", "my", "right now" and dates are resolved server-side**, never guessed by the model.

Portfolio project with a 6-day budget. Prefer what a reviewer can see over invisible depth.

## Working rules

**Top priority: spend as few tokens as the job needs.** Tokens are money. Keep code simple, refactor only when a change needs it, and don't overcomplicate. Read only the files a step needs, run only the tests it touches while working, and keep reports short. Write code efficient and like a 10 year experienced professional. 
- **No tests of any kind.** No unit, integration, e2e, snapshot tests, test files, or test dependencies. No perf measurement, profiling or bundle reporting. The owner tests in the browser.
- **Don't grow scope.** If something outside "In scope" seems needed, stop and ask. Don't add it.
- Work in small, reviewable steps that follow the build plan below. After each step, summarise what changed and how to check it in the browser.
- Keep `src/lib/domain` free of React and Next imports. All business logic lives there.
- TypeScript strict. No `any` unless commented why.
- Don't hard-code secrets. Read env vars only through `src/lib/env.ts`, validated with zod.
- Don't add "Claude" as co-author in any git commits or pushes. Only the author themselves.
- 
## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), TypeScript, React Server Components + server actions + route handlers |
| UI | Tailwind, shadcn/ui, lucide-react, Recharts, date-fns |
| Data | SQLite via better-sqlite3 + Drizzle ORM, drizzle-kit |
| Validation | zod (one schema per tool), zod-to-json-schema |
| AI | OpenRouter through the `openai` npm SDK, baseURL `https://openrouter.ai/api/v1` |

No Nest, no separate backend, no auth library.

## Commands

```bash
npm run dev        # start dev server
npm run db:push    # apply schema
npm run db:seed    # seed deterministic demo data
npm run db:reset   # delete ./data/promptpm.db, push, seed
npm run lint
```

## Environment

```
OPENROUTER_API_KEY=   # required
OPENROUTER_MODEL=     # required; must be a model that supports tool calling on OpenRouter
```

Send headers `HTTP-Referer` (app URL) and `X-Title: PromptPM` on OpenRouter requests.

## Folder structure

```
src/
  app/
    page.tsx                      # board (left) + chat panel (right, 420px)
    log/page.tsx                  # command log
    api/chat/route.ts             # agent entry
    api/actions/[id]/confirm/route.ts
    api/actions/[id]/undo/route.ts
    api/issues/search/route.ts    # # autocomplete
  db/
    schema.ts  client.ts  seed.ts
  lib/
    env.ts
    domain/   currentUser.ts issueKey.ts sprint.ts workload.ts burndown.ts events.ts
    ai/       openrouter.ts agent.ts registry.ts prompts.ts
    ai/tools/ find_user.ts list_issues.ts get_issue.ts get_sprint.ts
              get_burndown.ts get_workload.ts update_issue.ts create_issue.ts
  components/
    board/    Board.tsx Column.tsx IssueCard.tsx IssueDrawer.tsx UserSwitcher.tsx
    chat/     ChatPanel.tsx MessageList.tsx PromptInput.tsx Steps.tsx BlockRenderer.tsx
    blocks/   IssueTable.tsx IssueCardBlock.tsx SprintSummary.tsx BurndownChart.tsx
              WorkloadStrip.tsx ConfirmCard.tsx ClarifyChips.tsx
```

## Data model (Drizzle, SQLite)

Dates are ISO text. JSON columns are text with `$type<>()`. Enums are text unions.

| Table | Fields |
| --- | --- |
| users | id, name, handle, role (`member` \| `lead`), capacityPointsPerSprint |
| projects | id, key (e.g. `PPM`), name |
| sprints | id, projectId, name, startDate, endDate, status (`planned` \| `active` \| `closed`) |
| issues | id, projectId, number, title, description, type (`story` \| `bug` \| `task`), status (`backlog` \| `todo` \| `in_progress` \| `qa` \| `done`), priority (`low` \| `medium` \| `high` \| `urgent`), points, assigneeId?, sprintId?, createdAt, updatedAt |
| time_off | id, userId, startDate, endDate |
| issue_events | id, issueId, actorId, field, fromValue, toValue, actionId?, createdAt |
| actions | id, userId, prompt, toolName, args (JSON), status (`proposed` \| `confirmed` \| `undone` \| `expired`), createdAt |
| command_log | id, userId, prompt, model, toolsCalled (JSON), latencyMs, promptTokens, completionTokens, error?, createdAt |

- Issue `number` is one **global** sequence starting at 4500, unique across projects. `#4512`, `4512` and `PPM-4512` all resolve to the same issue.
- `issue_events` is the audit trail, the burndown source and the undo log.

### Domain formulas

- `workingDays(start, end)` excludes Saturdays and Sundays.
- `effectiveCapacity = capacityPointsPerSprint × (workingDays − timeOffDays) / workingDays`
- `remainingPoints` = sum of points for the user's issues in the sprint that aren't `done`.
- `loadPct = remainingPoints / effectiveCapacity × 100`. Over 100 means overloaded.
- Burndown per sprint day: `ideal` is a straight line from the starting total to 0. `actual` = total points minus points of issues whose `status` event moved to `done` on or before that day. Points added after the start are reported as `scopeAdded`, not hidden.

### Seed (deterministic, fixed random seed)

- Users: Abhi (lead), Priya Shah, Priya Kumar (two Priyas on purpose, for the clarify flow), Rohan Mehta. Capacity 20–30.
- Projects: `PPM` (PromptPM Web), `API` (PromptPM API).
- Per project: one closed sprint (two weeks, ended 14 days ago) and one active sprint (started 6 days ago, ends in 8 days).
- About 80 issues with realistic titles, mixed types and priorities, points from {1,2,3,5,8}, some unassigned, about 15 in backlog with no sprint.
- Priya Kumar has time off covering 3 working days of the active sprint.
- Active-sprint `issue_events` over the last 6 days move issues todo → in_progress → qa → done, so about 40% of points are done. Two issues are added mid-sprint.
- Default current user is Abhi.

## Tools

Each tool file exports `{ name, description, schema (zod), handler(args, ctx) }`, where `ctx = { user, now }`.
`registry.ts` exports `toolDefinitions` (OpenAI tool format, JSON schema from zod) and
`runTool(name, rawArgs, ctx) → { ok: true, data, block } | { ok: false, error }`.

- `data` goes back to the model. Keep it compact.
- `block` goes to the UI only, never to the model: `{ type, props }`.

| Tool | Kind | Args | Block |
| --- | --- | --- | --- |
| find_user | read | query | none, or `ClarifyChips` if 2+ matches score within 0.15 |
| list_issues | read | assignee? (`"me"` or user id), status?, sprint? (`"current"` or id), project?, type?, priority?, text?, limit (default 25) | `IssueTable` |
| get_issue | read | key | `IssueCard` |
| get_sprint | read | id or `"current"` | `SprintSummary` |
| get_burndown | read | sprint (default `"current"`) | `BurndownChart` |
| get_workload | read | userIds?, sprint? | `WorkloadStrip` |
| update_issue | write | key or keys[], patch {status?, assigneeId?, priority?, points?, sprintId?, title?} | `ConfirmCard` |
| create_issue | write | project, title, type, priority?, points?, assigneeId?, sprintId? | `ConfirmCard` |

Rules:

- `"me"` resolves to `ctx.user` inside the handler. `"current"` resolves through `getActiveSprint`.
- An ambiguous issue key or user returns `ClarifyChips`, never a guess.
- **Write handlers never modify issues.** They validate, resolve, check permission, cap bulk at 20 issues, insert an `actions` row with status `proposed`, and return `ConfirmCard { actionId, summary, changes: [{ key, title, field, from, to }] }`.
- Permissions: members edit issues in their projects; only leads reassign issues owned by others.

### Confirm and undo

- `POST /api/actions/[id]/confirm`: only the action's own user. Reject if the action isn't `proposed`. If it's older than 10 minutes, mark it `expired` and reject. Otherwise apply it in **one transaction** via `applyIssuePatch` (or insert the issue), write `issue_events` tagged with `actionId`, and mark it `confirmed`.
- `POST /api/actions/[id]/undo`: revert every `issue_events` row for that `actionId` in reverse order, in one transaction, and mark the action `undone`.

## Agent loop (`src/lib/ai/agent.ts`)

`runAgent(prompt, history, ctx) → { text, blocks, steps: [{ tool, args, ok }] }`

- The system prompt includes today's date, the current user's name and id, and these rules:
  - Always use tools for facts. Never invent issue data.
  - Keep the final text to one or two sentences, because the UI renders the data.
  - For changes, call the write tool and let the user confirm. Never claim a change is done.
  - Ask a short question when a request is ambiguous.
- Loop at most 5 steps: call `chat.completions` with `toolDefinitions`, run each tool call through `runTool`, and append the tool result (`data` only).
- History is the last 6 turns, as text only.
- `POST /api/chat` runs the agent and writes one `command_log` row (model, tools called, latency, token usage from the response, error). It returns a friendly message on API failure.
- No streaming.

## UI

- **Layout:** header (app name, project tabs, user switcher, link to `/log`); board on the left; chat panel on the right.
- **Board:** active sprint, five status columns, cards (key, title, type icon, priority badge, points, assignee avatar). Clicking a card opens the issue drawer (shadcn Sheet) with editable status, assignee, priority and points, plus the last 10 events. Edits go through a server action using `applyIssuePatch`. No drag-and-drop.
- **User switcher:** sets a `userId` cookie, then refreshes.
- **Chat panel:** user bubbles; assistant turns show text, then blocks via `BlockRenderer`, then a collapsible Steps line (`find_user("priya") → list_issues(…)`). The input is pinned at the bottom, Enter sends, and Cmd/Ctrl+K focuses it. Typing `#` opens issue-key autocomplete. Conversation state lives on the client only.
- **Empty state chips:** What are my tasks right now? · What's stuck in QA? · Show the burndown · Show Priya's backlog and availability · Who is overloaded this sprint? · Move #4512 to QA
- **Blocks:**
  - `IssueTable`: key, title, status pill, assignee avatar, points, and total points in the footer. Clicking a row opens the issue drawer.
  - `IssueCard`: full issue plus its last 5 events.
  - `SprintSummary`: dates, days left, and points done/total with a progress bar.
  - `BurndownChart`: Recharts line chart with ideal (dashed) vs actual, today marked, and scope-added days shown as dots with tooltips.
  - `WorkloadStrip`: one row per person with remaining vs effective capacity, load %, a "N days off" badge, and red when over 100%.
  - `ConfirmCard`: summary, before → after list, and Confirm / Cancel. After Confirm it shows "Done" with an Undo button. Errors show inline. After confirm or undo, call `router.refresh()` so the board visibly updates.
  - `ClarifyChips`: a question plus buttons. Clicking one resends the original prompt with the choice appended.
- **`/log` page:** a summary strip (p50/p95 latency, average tokens per command for reads vs writes, estimated cost per 100 commands from a `MODEL_PRICES` constant, average tool calls per prompt, clarification rate, confirmed/cancelled/undone counts), then a table of the last 200 commands.

## Scope

**In:** everything above.

**Out (don't build):** real auth and invites, comments, notifications, attachments, custom fields, drag-and-drop, real-time sync, multiple workspaces, spreadsheet-style views, streaming, tests.

**Only if the owner says yes:** eval script comparing models, MCP server exposing the tools, reuse of the Dashboard UI Kit.

## Build plan

Do one step at a time. Stop after each step for review.

1. Scaffold app, dependencies, folders, env validation, empty split layout.
2. Drizzle schema, config and db scripts.
3. Deterministic seed.
4. Domain logic: current user, issue key parsing, sprint helpers, workload, burndown, `applyIssuePatch`.
5. Board, issue drawer, user switcher.
6. Tool schemas, registry and the six read handlers.
7. Write handlers, confirm and undo routes.
8. OpenRouter client, agent loop, `/api/chat` and command logging.
9. Chat panel shell: messages, input, steps, suggested prompts, Cmd+K, `#` autocomplete.
10. Blocks: IssueTable, IssueCard, SprintSummary, ClarifyChips.
11. Blocks: BurndownChart, WorkloadStrip, ConfirmCard with undo and board refresh.
12. `/log` page.
13. README:
    - pitch and demo GIF placeholder
    - problem
    - tools and example prompts
    - mermaid architecture diagram
    - safety design
    - numbers from `/log`
    - tradeoffs (tool calling vs text-to-SQL, confirm friction, no streaming, SQLite)
    - what's next
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
