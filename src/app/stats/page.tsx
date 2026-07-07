import { StatsView } from "@/components/stats/StatsView";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cost & usage</h1>
        <p className="mt-1 text-sm text-muted">
          Agent spend and activity across repositories, models, and time.
        </p>
      </div>
      <StatsView />
    </div>
  );
}
