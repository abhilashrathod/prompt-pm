import { z } from "zod";
import { listUsers } from "@/lib/domain/currentUser";
import { defineTool } from "./types";
import { ok } from "./shared";

const MIN_SCORE = 0.5;
const TIE_GAP = 0.15;

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
const similarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

function score(query: string, name: string, handle: string): number {
  const q = query.toLowerCase().replace(/^@/, "").trim();
  const n = name.toLowerCase();
  const h = handle.toLowerCase();
  if (q === n || q === h) return 1;
  if (n.startsWith(q)) return 0.9;
  const tokens = [...n.split(/\s+/), ...h.split(/[.\-_]/)];
  if (tokens.some((t) => t.startsWith(q))) return 0.85;
  if (n.includes(q)) return 0.7;
  // Typos: best of whole-name and per-token similarity.
  return Math.max(similarity(q, n), ...tokens.map((t) => similarity(q, t))) * 0.8;
}

export const findUser = defineTool({
  name: "find_user",
  description:
    'Look up a teammate by name or handle (e.g. "priya", "rohan"). Returns their user id for other tools. ' +
    'If several people match, the user is asked to pick and you should stop. Use "me" in other tools for the current user instead of calling this.',
  kind: "read",
  schema: z.object({ query: z.string().trim().min(1).describe("Name, first name or handle") }),
  handler({ query }, ctx) {
    if (["me", "my", "myself", "i"].includes(query.toLowerCase())) {
      const u = ctx.user;
      return ok({ user: { id: u.id, name: u.name, handle: u.handle, role: u.role } });
    }
    const ranked = listUsers()
      .map((u) => ({ u, s: score(query, u.name, u.handle) }))
      .filter((r) => r.s >= MIN_SCORE)
      .sort((a, b) => b.s - a.s);

    if (!ranked.length) return ok({ user: null, message: `No teammate matches "${query}".` });

    const tied = ranked.filter((r) => ranked[0].s - r.s <= TIE_GAP);
    if (tied.length > 1) {
      const question = `Which ${query}?`;
      return ok(
        { needsClarification: true, question, candidates: tied.map(({ u }) => ({ id: u.id, name: u.name })) },
        {
          type: "ClarifyChips",
          props: { question, options: tied.map(({ u }) => ({ label: u.name, value: `I mean ${u.name} (user id ${u.id})` })) },
        },
      );
    }
    const u = ranked[0].u;
    return ok({ user: { id: u.id, name: u.name, handle: u.handle, role: u.role } });
  },
});
