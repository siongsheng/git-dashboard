import path from "node:path";
import { execFile } from "node:child_process";
import { query, type Options, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { desc, eq } from "drizzle-orm";
import { getDb, agentRuns, repos, runEvents, tasks, type Repo, type Task } from "@/db";
import { addWorktree, resolveRef, worktreeExists } from "@/lib/git";
import { agentBranchName, taskSlug } from "@/lib/slug";
import type { RunEventType } from "@/lib/types";
import { RunEmitter } from "./run-events";

interface ActiveRun {
  runId: number;
  taskId: number;
  abortController: AbortController;
  query: Query;
  emitter: RunEmitter;
  seq: number;
}

export type StartMode = "fresh" | "resume";

const GUARDRAIL_DISALLOWED_TOOLS = [
  "Bash(git push:*)",
  "Bash(git remote:*)",
  "Bash(npm publish:*)",
  "Bash(sudo:*)",
  "Bash(rm -rf /:*)",
  "Bash(rm -rf ~:*)",
];

export class RunManager {
  private active = new Map<number, ActiveRun>(); // by runId
  private activeByTask = new Map<number, number>(); // taskId -> runId

  getActiveRun(runId: number): ActiveRun | undefined {
    return this.active.get(runId);
  }

  isTaskActive(taskId: number): boolean {
    return this.activeByTask.has(taskId);
  }

  async startRun(
    taskId: number,
    opts: { mode?: StartMode; followUpPrompt?: string } = {},
  ): Promise<{ runId: number }> {
    const db = getDb();
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (this.activeByTask.has(taskId)) {
      throw new Error(`Task ${taskId} already has an active agent run`);
    }
    const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
    if (!repo) throw new Error(`Repo ${task.repoId} not found`);

    const prepared = await this.ensureWorktree(task, repo);

    // Resume the previous SDK session when iterating on feedback.
    let resumeSessionId: string | undefined;
    if (opts.mode === "resume") {
      const lastRun = db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.taskId, taskId))
        .orderBy(desc(agentRuns.id))
        .limit(1)
        .get();
      resumeSessionId = lastRun?.sessionId ?? undefined;
    }

    const inserted = db
      .insert(agentRuns)
      .values({ taskId, status: "starting", model: task.model })
      .returning({ id: agentRuns.id })
      .get();
    const runId = inserted.id;

    db.update(tasks)
      .set({ status: "running", updatedAt: Date.now() })
      .where(eq(tasks.id, taskId))
      .run();

    const prompt = opts.followUpPrompt
      ? buildFollowUpPrompt(opts.followUpPrompt)
      : buildInitialPrompt(task);

    const abortController = new AbortController();
    const options: Options = {
      cwd: prepared.worktreePath,
      permissionMode: "acceptEdits",
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch"],
      disallowedTools: GUARDRAIL_DISALLOWED_TOOLS,
      model: task.model,
      maxTurns: 100,
      abortController,
      ...(task.maxBudgetUsd ? { maxBudgetUsd: task.maxBudgetUsd } : {}),
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    };

    const q = query({ prompt, options });
    const activeRun: ActiveRun = {
      runId,
      taskId,
      abortController,
      query: q,
      emitter: new RunEmitter(),
      seq: 0,
    };
    this.active.set(runId, activeRun);
    this.activeByTask.set(taskId, runId);

    // Detached consumer loop — the API route returns immediately.
    void this.consume(activeRun, repo).catch((err) => {
      console.error(`[run ${runId}] consumer crashed:`, err);
    });

    return { runId };
  }

  private async ensureWorktree(
    task: Task,
    repo: Repo,
  ): Promise<{ worktreePath: string; branchName: string; baseRef: string }> {
    const db = getDb();
    if (task.worktreePath && task.branchName && task.baseRef && worktreeExists(task.worktreePath)) {
      return {
        worktreePath: task.worktreePath,
        branchName: task.branchName,
        baseRef: task.baseRef,
      };
    }
    const baseRef = await resolveRef(repo.path, repo.defaultBranch);
    const branchName = agentBranchName(task.title, task.id);
    const worktreePath = path.join(
      process.cwd(),
      "data",
      "worktrees",
      String(repo.id),
      taskSlug(task.title, task.id),
    );
    await addWorktree(repo.path, worktreePath, branchName, baseRef);
    db.update(tasks)
      .set({ branchName, baseRef, worktreePath, updatedAt: Date.now() })
      .where(eq(tasks.id, task.id))
      .run();
    return { worktreePath, branchName, baseRef };
  }

  private async consume(active: ActiveRun, repo: Repo) {
    const db = getDb();
    const { runId, taskId } = active;
    let finalStatus: "completed" | "failed" | "cancelled" = "failed";
    let errorMessage: string | null = null;

    try {
      for await (const message of active.query) {
        const eventType = normalizeMessage(message);
        const seq = ++active.seq;
        db.insert(runEvents)
          .values({ runId, seq, eventType, payload: JSON.stringify(message) })
          .run();
        active.emitter.emitEvent({ seq, eventType, payload: message });

        if (message.type === "system" && message.subtype === "init") {
          db.update(agentRuns)
            .set({ sessionId: message.session_id, model: message.model, status: "running" })
            .where(eq(agentRuns.id, runId))
            .run();
        }

        if (message.type === "result") {
          const success = message.subtype === "success" && !message.is_error;
          finalStatus = success ? "completed" : "failed";
          if (!success) {
            errorMessage =
              "errors" in message && Array.isArray(message.errors) && message.errors.length
                ? message.errors.join("; ")
                : `Run ended with ${message.subtype}`;
          }
          // usage.input_tokens excludes cache reads/writes; count total input.
          const usage = message.usage;
          const totalInput = usage
            ? (usage.input_tokens ?? 0) +
              (usage.cache_read_input_tokens ?? 0) +
              (usage.cache_creation_input_tokens ?? 0)
            : null;
          db.update(agentRuns)
            .set({
              costUsd: message.total_cost_usd,
              numTurns: message.num_turns,
              inputTokens: totalInput,
              outputTokens: usage?.output_tokens ?? null,
            })
            .where(eq(agentRuns.id, runId))
            .run();
        }
      }
    } catch (err) {
      if (active.abortController.signal.aborted) {
        finalStatus = "cancelled";
      } else {
        finalStatus = "failed";
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    if (active.abortController.signal.aborted && finalStatus !== "completed") {
      finalStatus = "cancelled";
    }

    // Run the repo's test command in the worktree after a successful run.
    let testStatus: "passed" | "failed" | "skipped" = "skipped";
    let testOutput: string | null = null;
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (finalStatus === "completed" && repo.testCommand && task?.worktreePath) {
      const result = await runTestCommand(repo.testCommand, task.worktreePath);
      testStatus = result.passed ? "passed" : "failed";
      testOutput = result.output;
      const seq = ++active.seq;
      const testEvent = {
        type: "dashboard_test_result",
        status: testStatus,
        command: repo.testCommand,
        output: result.output.slice(-8000),
      };
      db.insert(runEvents)
        .values({ runId, seq, eventType: "other", payload: JSON.stringify(testEvent) })
        .run();
      active.emitter.emitEvent({ seq, eventType: "other", payload: testEvent });
    }

    db.update(agentRuns)
      .set({
        status: finalStatus,
        errorMessage,
        testStatus: finalStatus === "completed" ? testStatus : null,
        testOutput,
        finishedAt: Date.now(),
      })
      .where(eq(agentRuns.id, runId))
      .run();

    const taskStatus =
      finalStatus === "completed" || finalStatus === "cancelled" ? "awaiting_review" : "failed";
    db.update(tasks)
      .set({ status: taskStatus, updatedAt: Date.now() })
      .where(eq(tasks.id, taskId))
      .run();

    active.emitter.emitTerminal();
    this.active.delete(runId);
    this.activeByTask.delete(taskId);
  }

  async stopRun(runId: number): Promise<void> {
    const active = this.active.get(runId);
    if (!active) throw new Error(`Run ${runId} is not active`);
    // Graceful interrupt first; abort is the definitive kill signal the
    // consume loop uses to classify the run as cancelled.
    try {
      await Promise.race([
        active.query.interrupt(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // interrupt can reject if the subprocess is already tearing down
    }
    active.abortController.abort();
    try {
      active.query.close();
    } catch {
      // already closed
    }
  }
}

function buildInitialPrompt(task: Task): string {
  return [
    `You are implementing a ${task.type} in this repository.`,
    "",
    `## Task: ${task.title}`,
    "",
    task.description,
    "",
    "## Instructions",
    "- You are on a dedicated branch in an isolated git worktree; work only in the current directory.",
    "- Implement the task completely, following existing code conventions.",
    "- Run relevant tests or checks if the project has them.",
    "- Commit your work on the current branch with clear, conventional commit messages.",
    "- Do NOT push, do NOT switch branches, do NOT modify git config.",
  ].join("\n");
}

function buildFollowUpPrompt(feedback: string): string {
  return [
    "The reviewer looked at your work and has follow-up feedback:",
    "",
    feedback,
    "",
    "Address the feedback, then commit the changes on the current branch with clear messages.",
    "Do NOT push, do NOT switch branches.",
  ].join("\n");
}

function normalizeMessage(message: SDKMessage): RunEventType {
  switch (message.type) {
    case "system":
      return "subtype" in message && message.subtype === "init" ? "init" : "other";
    case "assistant": {
      const content = message.message?.content;
      if (Array.isArray(content)) {
        if (content.some((b) => b.type === "tool_use")) return "tool_use";
        if (content.every((b) => b.type === "thinking" || b.type === "redacted_thinking"))
          return "thinking";
      }
      return "text";
    }
    case "user":
      return "tool_result";
    case "result":
      return "result";
    default:
      return "other";
  }
}

function runTestCommand(
  command: string,
  cwd: string,
): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(
      "/bin/sh",
      ["-c", command],
      { cwd, timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          passed: !err,
          output: [stdout, stderr].filter(Boolean).join("\n---stderr---\n"),
        });
      },
    );
  });
}

const g = globalThis as unknown as { __runManager?: RunManager };
export function getRunManager(): RunManager {
  return (g.__runManager ??= new RunManager());
}
