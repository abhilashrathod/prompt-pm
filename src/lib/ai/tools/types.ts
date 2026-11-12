import type { z } from "zod";
import type { Ctx } from "@/lib/domain/currentUser";
import type { Burndown } from "@/lib/domain/burndown";
import type { IssueDetail, IssueListItem } from "@/lib/domain/issues";
import type { SprintSummary } from "@/lib/domain/sprint";
import type { WorkloadRow } from "@/lib/domain/workload";

/** UI-only payloads. Built server-side from tool results; never sent to the model. */
export type Block =
  | { type: "IssueTable"; props: { title: string; issues: IssueListItem[]; totalPoints: number; truncated: boolean } }
  | { type: "IssueCard"; props: IssueDetail }
  | { type: "SprintSummary"; props: SprintSummary }
  | { type: "BurndownChart"; props: Burndown }
  | { type: "WorkloadStrip"; props: { title: string; rows: WorkloadRow[] } }
  | { type: "ClarifyChips"; props: { question: string; options: { label: string; value: string }[] } };

/** `projectKey` is the board tab the user is looking at; used only to break "current sprint" ties. */
export type ToolCtx = Ctx & { projectKey?: string };

export type ToolResult = { ok: true; data: unknown; block?: Block } | { ok: false; error: string };

export type Tool<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  kind: "read" | "write";
  schema: S;
  // Method syntax keeps the registry array assignable across different arg types.
  handler(args: z.infer<S>, ctx: ToolCtx): ToolResult;
};

export const defineTool = <S extends z.ZodTypeAny>(t: Tool<S>): Tool<S> => t;
