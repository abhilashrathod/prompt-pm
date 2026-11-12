import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const DB_PATH = "data/promptpm.db";

function open() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type DB = BetterSQLite3Database<typeof schema>;

// Reuse one connection across dev hot reloads.
const g = globalThis as unknown as { __db?: DB };
export const db: DB = g.__db ?? open();
if (process.env.NODE_ENV !== "production") g.__db = db;

/** A db handle or a transaction; domain writes accept either. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Conn = DB | Tx;
