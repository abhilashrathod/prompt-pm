"use client";

import { useTransition } from "react";
import { switchUser } from "@/app/actions";
import { UserAvatar } from "@/components/IssueBits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: number; name: string; role: string };

export function UserSwitcher({ users, currentId }: { users: Option[]; currentId: number }) {
  const [pending, startTransition] = useTransition();
  const items = users.map((u) => ({ value: String(u.id), label: u.name }));
  return (
    <Select
      items={items}
      value={String(currentId)}
      onValueChange={(v) => v && startTransition(() => switchUser(Number(v)))}
      disabled={pending}
    >
      <SelectTrigger size="sm" className="min-w-40" aria-label="Current user">
        <UserAvatar userId={currentId} name={users.find((u) => u.id === currentId)?.name ?? null} className="size-5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.name}
            <span className="text-xs text-muted-foreground">{u.role}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
