import { requireAdmin } from "@/lib/auth/guards";
import { AdminRankingDashboard } from "@/components/admin/AdminRankingDashboard";

export default async function AdminRankingPage() {
  // 1. Centralized Auth Check
  const { supabase } = await requireAdmin();

  // 2. Parallel Data Fetching
  const [configResult, statsResult, topItemsResult] = await Promise.all([
    supabase.from("ranking_config").select("*").order("config_key"),
    supabase
      .from("ranking_stats")
      .select("*")
      .order("window_end", { ascending: true })
      .limit(20),
    supabase
      .from("ranking_scores")
      .select("*")
      .not("norm_score", "is", null)
      .order("norm_score", { ascending: false })
      .limit(50),
  ]);

  const configMap: Record<string, any> = {};
  configResult.data?.forEach((item) => {
    configMap[item.config_key] = item.config_value;
  });

  return (
    <div className="container mx-auto px-page py-section max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-jet-dark mb-2">
          Ranking System Intelligence
        </h1>
        <p className="text-gray-muted">
          Analyze feed performance and configure the algorithm.
        </p>
      </div>

      <AdminRankingDashboard
        initialConfig={configMap}
        initialStats={statsResult.data || []}
        initialTopItems={topItemsResult.data || []}
      />
    </div>
  );
}
