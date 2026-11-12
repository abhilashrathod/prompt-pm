import { STATUS_LABEL } from "@/components/IssueBits";
import type { IssueStatus } from "@/db/schema";
import type { IssueListItem } from "@/lib/domain/issues";
import { IssueCard } from "./IssueCard";

export function Column({
  status,
  issues,
  hrefFor,
}: {
  status: IssueStatus;
  issues: IssueListItem[];
  hrefFor: (key: string) => string;
}) {
  const points = issues.reduce((s, i) => s + i.points, 0);
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-muted/50 p-2">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span className="uppercase tracking-wide">{STATUS_LABEL[status]}</span>
        <span className="rounded bg-background px-1.5 tabular-nums">{issues.length}</span>
        <span className="ml-auto tabular-nums">{points} pts</span>
      </div>
      <div className="flex flex-col gap-2">
        {issues.map((i) => (
          <IssueCard key={i.id} issue={i} href={hrefFor(i.key)} />
        ))}
      </div>
    </div>
  );
}
