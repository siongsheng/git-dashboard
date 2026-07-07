// Runs once per server boot, before serving requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./db/migrate");
    runMigrations();
    const { cleanupOrphanedRuns } = await import("./server/orphans");
    cleanupOrphanedRuns();
  }
}
