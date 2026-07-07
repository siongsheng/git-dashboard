import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./index";

// Applies generated SQL migrations from ./drizzle on boot (idempotent).
export function runMigrations() {
  migrate(getDb(), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}
