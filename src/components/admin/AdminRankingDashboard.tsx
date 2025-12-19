"use client";

import { useState } from "react";
import dynamic from "next/dynamic"; // <--- Import dynamic
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { Loader } from "@/components/ui/Loader"; // Use your unified loader

// Lazy load the chart. ssr: false is required for Recharts.
const RankingChart = dynamic(() => import("./RankingChart"), {
  loading: () => (
    <div className="h-[300px] w-full flex items-center justify-center bg-gray-50 rounded-lg">
      <Loader />
    </div>
  ),
  ssr: false,
});

interface RankingDashboardProps {
  initialConfig: Record<string, any>;
  initialStats: any[];
  initialTopItems: any[];
}

export function AdminRankingDashboard({
  initialConfig,
  initialStats,
  initialTopItems,
}: RankingDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [stats] = useState(initialStats);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const featureEnabled = isFeatureEnabled("ranking/final-algo");

  const triggerRecompute = async (
    itemType?: "card" | "collection",
    dryRun: boolean = false
  ) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/workers/ranking/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: itemType,
          changed_since_days: 30,
          dry_run: dryRun,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMessage({
        type: "success",
        text: dryRun
          ? `Dry run: ${data.succeeded} items would update`
          : `Success: ${data.succeeded} items updated`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Format stats for chart
  const chartData = stats.map((s) => ({
    date: new Date(s.window_end).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: s.mean_raw_score,
    count: s.item_count,
    type: s.item_type,
  }));

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-emerald/10 border-emerald/20 text-emerald-dark"
              : "bg-red-50 border-red-100 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 1. Control Panel & Config Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-bold text-jet-dark">
              Algorithm Controls
            </h2>
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                featureEnabled
                  ? "bg-emerald/10 text-emerald"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              Feature Flag: {featureEnabled ? "Active" : "Inactive"}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => triggerRecompute(undefined, false)}
              disabled={isLoading}
              variant="primary"
            >
              {isLoading ? "Processing..." : "Recompute All Scores"}
            </Button>
            <Button
              onClick={() => triggerRecompute(undefined, true)}
              disabled={isLoading}
              variant="outline"
            >
              Dry Run (Test)
            </Button>
            <div className="w-px h-10 bg-gray-200 mx-2 hidden sm:block"></div>
            <Button
              onClick={() => triggerRecompute("card", false)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Cards Only
            </Button>
            <Button
              onClick={() => triggerRecompute("collection", false)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Collections Only
            </Button>
          </div>
        </Card>

        {/* Config Summary */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-jet-dark mb-4">Weights</h2>
          <div className="space-y-3">
            {Object.entries(initialConfig)
              .slice(0, 5)
              .map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span
                    className="text-gray-muted truncate max-w-[180px]"
                    title={key}
                  >
                    {key.replace("weight_", "").replace(/_/g, " ")}
                  </span>
                  <span className="font-mono font-bold">{String(val)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* 2. Performance Chart - NOW LAZY LOADED */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-jet-dark mb-6">
          Average Score Trends
        </h2>
        <RankingChart data={chartData} />
      </Card>

      {/* 3. Top Items Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-light">
          <h2 className="text-xl font-bold text-jet-dark">Top Ranked Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">ID</th>
                <th className="px-6 py-3 text-right">Raw Score</th>
                <th className="px-6 py-3 text-right">Normalized</th>
                <th className="px-6 py-3 text-right">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-light">
              {initialTopItems.map((item) => (
                <tr
                  key={`${item.item_type}-${item.item_id}`}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-3 font-medium capitalize">
                    {item.item_type}
                  </td>
                  <td className="px-6 py-3 font-mono text-gray-muted text-xs">
                    {item.item_id.split("-")[0]}...
                  </td>
                  <td className="px-6 py-3 text-right font-mono">
                    {item.raw_score.toFixed(4)}
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-emerald">
                    {(item.norm_score * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-3 text-right text-gray-muted text-xs">
                    {new Date(
                      item.last_event_at || Date.now()
                    ).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
