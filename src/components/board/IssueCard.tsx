import Link from "next/link";
import { PriorityBadge, TypeIcon, UserAvatar } from "@/components/IssueBits";
import type { IssueListItem } from "@/lib/domain/issues";

export function IssueCard({ issue, href }: { issue: IssueListItem; href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="block rounded-md border bg-card p-2.5 text-sm shadow-xs transition-colors hover:border-foreground/30"
    >
      <p className="line-clamp-2 leading-snug">{issue.title}</p>
      <div className="mt-2 flex items-center gap-2">
        <TypeIcon type={issue.type} />
        <span className="font-mono text-[11px] text-muted-foreground">{issue.key}</span>
        <PriorityBadge priority={issue.priority} />
        <span className="ml-auto rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{issue.points}</span>
        <UserAvatar userId={issue.assigneeId} name={issue.assigneeName} />
      </div>
    </Link>
  );
}
