import { requireAdmin } from "@/lib/auth/guards";
import { ReportsList } from "@/components/admin/ReportsList";
import Link from "next/link";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // 1. Centralized Auth Check
  const { supabase } = await requireAdmin();

  const resolvedSearchParams = await searchParams;
  const currentStatus = resolvedSearchParams.status || "open";

  // Fetch reports
  const { data: rawReports, error } = await supabase
    .from("reports")
    .select(
      `
      id, reporter_id, target_type, target_id, reason, data, status, created_at,
      reporter:users!reports_reporter_id_fkey ( id, username, display_name, avatar_url )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) console.error("Error fetching reports:", error);

  const reports = (rawReports || []).map((report: any) => ({
    ...report,
    reporter: Array.isArray(report.reporter)
      ? report.reporter[0]
      : report.reporter,
  }));

  const counts = {
    open: reports.filter((r: any) => r.status === "open").length,
    resolved: reports.filter((r: any) => r.status === "resolved").length,
    dismissed: reports.filter((r: any) => r.status === "dismissed").length,
  };

  const filteredReports = reports.filter(
    (r: any) => r.status === currentStatus
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 md:px-8 py-6 md:py-12 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-jet-dark mb-2">
              Moderation Queue
            </h1>
            <p className="text-gray-500">
              Review and take action on user reports.
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max">
            {["open", "resolved", "dismissed"].map((tab) => (
              <Link
                key={tab}
                href={`/admin/reports?status=${tab}`}
                className={`
                  px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${
                    currentStatus === tab
                      ? "border-emerald-600 text-emerald-600"
                      : "border-transparent text-gray-500 hover:text-jet-dark hover:border-gray-300"
                  }
                `}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    currentStatus === tab
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts[tab as keyof typeof counts]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {filteredReports.length > 0 ? (
          <ReportsList
            initialReports={filteredReports}
            initialStatus={currentStatus}
          />
        ) : (
          <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-lg font-bold text-jet-dark mb-1">All clear!</h3>
            <p className="text-gray-500">No {currentStatus} reports found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
