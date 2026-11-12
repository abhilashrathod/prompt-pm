import { format, parseISO } from "date-fns";
import type { IssueStatus, Priority } from "@/db/schema";
import type { IssueListItem } from "@/lib/domain/issues";
import type { SprintSummary } from "@/lib/domain/sprint";
import { Column } from "./Column";

const BOARD_COLUMNS: IssueStatus[] = ["backlog", "todo", "in_progress", "qa", "done"];
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function Board({
  summary,
  issues,
  projectKey,
}: {
  summary: SprintSummary | null;
  issues: IssueListItem[];
  projectKey: string;
}) {
  if (!summary) return <p className="text-sm text-muted-foreground">No active sprint for {projectKey}.</p>;

  const pct = summary.totalPoints ? Math.round((summary.donePoints / summary.totalPoints) * 100) : 0;
  const hrefFor = (key: string) => `/?project=${projectKey}&issue=${key}`;
  const sorted = [...issues].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.number - b.number);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-base font-semibold">{summary.name}</h1>
        <span className="text-sm text-muted-foreground">
          {format(parseISO(summary.startDate), "MMM d")} – {format(parseISO(summary.endDate), "MMM d")} · {summary.daysLeft} days left
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {summary.donePoints}/{summary.totalPoints} pts done ({pct}%)
        </span>
      </div>
      <div className="grid min-w-[960px] grid-cols-5 items-start gap-3">
        {BOARD_COLUMNS.map((status) => (
          <Column key={status} status={status} issues={sorted.filter((i) => i.status === status)} hrefFor={hrefFor} />
        ))}
      </div>
    </div>
  );
}
