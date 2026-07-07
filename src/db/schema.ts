import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  defaultBranch: text("default_branch").notNull(),
  testCommand: text("test_command"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // feature | bug | chore
  status: text("status").notNull().default("queued"), // queued | running | awaiting_review | done | failed
  model: text("model").notNull(),
  maxBudgetUsd: real("max_budget_usd"),
  branchName: text("branch_name"),
  baseRef: text("base_ref"),
  worktreePath: text("worktree_path"),
  prUrl: text("pr_url"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  status: text("status").notNull().default("starting"), // starting | running | completed | failed | cancelled
  model: text("model"),
  costUsd: real("cost_usd"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  numTurns: integer("num_turns"),
  testStatus: text("test_status"), // passed | failed | skipped
  testOutput: text("test_output"),
  errorMessage: text("error_message"),
  startedAt: integer("started_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  finishedAt: integer("finished_at"),
});

export const runEvents = sqliteTable(
  "run_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload").notNull(), // raw SDK message JSON, verbatim
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    uniqueIndex("run_events_run_seq").on(t.runId, t.seq),
    index("run_events_run").on(t.runId),
  ],
);

export type Repo = typeof repos.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;
