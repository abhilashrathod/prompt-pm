"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { updateIssue } from "@/app/actions";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, TypeIcon } from "@/components/IssueBits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ISSUE_STATUSES, PRIORITIES } from "@/db/schema";
import type { IssuePatch } from "@/lib/domain/events";
import type { EventView, IssueDetail } from "@/lib/domain/issues";

const POINT_OPTIONS = [0, 1, 2, 3, 5, 8, 13];
const UNASSIGNED = "none";
const FIELD_LABEL: Record<string, string> = {
  status: "status",
  assigneeId: "assignee",
  priority: "priority",
  points: "points",
  sprintId: "sprint",
  title: "title",
};

type Option = { value: string; label: string };

function Field({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <Select items={options} value={value} onValueChange={(v) => v != null && v !== value && onChange(v)} disabled={disabled}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

const show = (field: string, v: string | null) =>
  v == null ? "none" : field === "status" ? (STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v) : v;

function EventLine({ e }: { e: EventView }) {
  const what = e.field === "created" ? "created the issue" : `changed ${FIELD_LABEL[e.field] ?? e.field}`;
  return (
    <li className="text-xs leading-relaxed">
      <span className="font-medium">{e.actorName}</span> {what}
      {e.field !== "created" && (
        <>
          {" "}
          <span className="text-muted-foreground">{show(e.field, e.from)}</span> → <span>{show(e.field, e.to)}</span>
        </>
      )}
      <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
    </li>
  );
}

export function IssueDrawer({ issue, users }: { issue: IssueDetail | null; users: { id: number; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("issue");
    const qs = next.toString();
    setError(null);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const save = (patch: IssuePatch) =>
    startTransition(async () => {
      if (!issue) return;
      const res = await updateIssue(issue.id, patch);
      setError(res.ok ? null : res.error);
    });

  return (
    <Sheet open={issue != null} onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {issue && (
          <>
            <SheetHeader>
              <SheetDescription className="flex items-center gap-1.5 font-mono text-xs">
                <TypeIcon type={issue.type} /> {issue.key} · {TYPE_LABEL[issue.type]}
                {issue.sprintName && <> · {issue.sprintName}</>}
              </SheetDescription>
              <SheetTitle className="text-base leading-snug">{issue.title}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-6 text-sm">
              {issue.description && <p className="text-muted-foreground">{issue.description}</p>}
              <div className="flex flex-col gap-2">
                <Field
                  label="Status"
                  value={issue.status}
                  options={ISSUE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                  onChange={(v) => save({ status: v as IssuePatch["status"] })}
                  disabled={pending}
                />
                <Field
                  label="Assignee"
                  value={issue.assigneeId ? String(issue.assigneeId) : UNASSIGNED}
                  options={[
                    { value: UNASSIGNED, label: "Unassigned" },
                    ...users.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                  onChange={(v) => save({ assigneeId: v === UNASSIGNED ? null : Number(v) })}
                  disabled={pending}
                />
                <Field
                  label="Priority"
                  value={issue.priority}
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                  onChange={(v) => save({ priority: v as IssuePatch["priority"] })}
                  disabled={pending}
                />
                <Field
                  label="Points"
                  value={String(issue.points)}
                  options={[...new Set([...POINT_OPTIONS, issue.points])]
                    .sort((a, b) => a - b)
                    .map((p) => ({ value: String(p), label: String(p) }))}
                  onChange={(v) => save({ points: Number(v) })}
                  disabled={pending}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</h3>
                {issue.events.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {issue.events.map((e) => (
                      <EventLine key={e.id} e={e} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No activity yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
