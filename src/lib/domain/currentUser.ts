import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema";

export const USER_COOKIE = "userId";
const DEFAULT_HANDLE = "abhi";

/** Server-side request context. Tools and domain code never trust the model for these. */
export type Ctx = { user: User; now: Date };

export function listUsers(): User[] {
  return db.select().from(users).orderBy(asc(users.id)).all();
}

/** Cookie value → user. Falls back to Abhi so the demo always has someone signed in. */
export function resolveCurrentUser(cookieValue: string | undefined): User {
  const id = Number(cookieValue);
  const user = Number.isInteger(id) && id > 0 ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (user) return user;
  const fallback =
    db.select().from(users).where(eq(users.handle, DEFAULT_HANDLE)).get() ?? db.select().from(users).limit(1).get();
  if (!fallback) throw new Error("No users found. Run `npm run db:reset`.");
  return fallback;
}
