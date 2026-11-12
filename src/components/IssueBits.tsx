import { ArrowDown, ArrowUp, BookOpen, Bug, ChevronsUp, Minus, SquareCheck } from "lucide-react";
import type { IssueStatus, IssueType, Priority } from "@/db/schema";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  qa: "QA",
  done: "Done",
};
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
export const TYPE_LABEL: Record<IssueType, string> = { story: "Story", bug: "Bug", task: "Task" };

const TYPE_ICON = {
  story: { Icon: BookOpen, cls: "text-emerald-600" },
  bug: { Icon: Bug, cls: "text-red-600" },
  task: { Icon: SquareCheck, cls: "text-sky-600" },
} as const;

export function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const { Icon, cls } = TYPE_ICON[type];
  return <Icon aria-label={TYPE_LABEL[type]} className={cn("size-3.5 shrink-0", cls, className)} />;
}

const PRIORITY_STYLE = {
  urgent: { Icon: ChevronsUp, cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  high: { Icon: ArrowUp, cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  medium: { Icon: Minus, cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  low: { Icon: ArrowDown, cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
} as const;

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { Icon, cls } = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium", cls)}>
      <Icon className="size-3" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const STATUS_STYLE: Record<IssueStatus, string> = {
  backlog: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  qa: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function StatusPill({ status }: { status: IssueStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const AVATAR_COLORS = ["bg-indigo-500", "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-sky-500", "bg-rose-500"];

export function UserAvatar({ userId, name, className }: { userId: number | null; name: string | null; className?: string }) {
  if (userId == null || !name) {
    return (
      <span
        title="Unassigned"
        className={cn("inline-flex size-6 shrink-0 rounded-full border border-dashed border-muted-foreground/50", className)}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
        AVATAR_COLORS[userId % AVATAR_COLORS.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}
