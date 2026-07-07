export const TASK_TYPES = ["feature", "bug", "chore"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = [
  "queued",
  "running",
  "awaiting_review",
  "done",
  "failed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const RUN_STATUSES = [
  "starting",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TEST_STATUSES = ["passed", "failed", "skipped"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

// Normalized event categories for rendering the agent timeline.
// The raw SDK message JSON is stored verbatim in run_events.payload;
// this is only a coarse rendering hint.
export const RUN_EVENT_TYPES = [
  "init",
  "text",
  "thinking",
  "tool_use",
  "tool_result",
  "result",
  "error",
  "user_message",
  "other",
] as const;
export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export const MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 (default)" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5" },
] as const;
export const DEFAULT_MODEL = "claude-sonnet-5";
