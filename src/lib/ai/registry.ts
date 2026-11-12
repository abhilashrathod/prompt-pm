import { zodToJsonSchema } from "zod-to-json-schema";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { findUser } from "./tools/find_user";
import { getBurndownTool } from "./tools/get_burndown";
import { getIssue } from "./tools/get_issue";
import { getSprint } from "./tools/get_sprint";
import { getWorkloadTool } from "./tools/get_workload";
import { listIssuesTool } from "./tools/list_issues";
import type { Tool, ToolCtx, ToolResult } from "./tools/types";

export type { Block, Tool, ToolCtx, ToolResult } from "./tools/types";

const tools: Tool[] = [findUser, listIssuesTool, getIssue, getSprint, getBurndownTool, getWorkloadTool];
const byName = new Map(tools.map((t) => [t.name, t]));

export const toolDefinitions: ChatCompletionTool[] = tools.map((t) => {
  const parameters = zodToJsonSchema(t.schema, { $refStrategy: "none" }) as Record<string, unknown>;
  delete parameters.$schema;
  return { type: "function", function: { name: t.name, description: t.description, parameters } };
});

export const toolKind = (name: string) => byName.get(name)?.kind;

export function runTool(name: string, rawArgs: unknown, ctx: ToolCtx): ToolResult {
  const tool = byName.get(name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}".` };

  let input = rawArgs;
  if (typeof rawArgs === "string") {
    try {
      input = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, error: "Arguments were not valid JSON." };
    }
  }

  const parsed = tool.schema.safeParse(input ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ");
    return { ok: false, error: `Invalid arguments: ${msg}` };
  }

  try {
    return tool.handler(parsed.data, ctx);
  } catch (err) {
    console.error(`[tool ${name}]`, err);
    return { ok: false, error: "The tool failed unexpectedly." };
  }
}
