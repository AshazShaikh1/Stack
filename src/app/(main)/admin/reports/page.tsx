import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsList } from "@/components/admin/ReportsList";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userProfile?.role !== "admin") {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams.status || "open";

  // Fetch reports
  const { data: rawReports, error } = await supabase
    .from("reports")
    .select(
      `
      id,
      reporter_id,
      target_type,
      target_id,
      reason,
      data,
      status,
      created_at,
      reporter:users!reports_reporter_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching reports:", error);
  }

  const reports = (rawReports || []).map((report: any) => ({
    ...report,
    reporter: Array.isArray(report.reporter)
      ? report.reporter[0]
      : report.reporter,
  }));

  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">
          Admin - Reports
        </h1>
        <p className="text-body text-gray-muted mb-6">
          Review and moderate user reports
        </p>

        {/* Status Filters */}
        <div className="flex gap-2 mb-6">
          <Link href="/admin/reports?status=open">
            <Button
              variant={status === "open" ? "primary" : "outline"}
              size="sm"
            >
              Open (
              {reports?.filter((r: any) => r.status === "open").length || 0})
            </Button>
          </Link>
          <Link href="/admin/reports?status=resolved">
            <Button
              variant={status === "resolved" ? "primary" : "outline"}
              size="sm"
            >
              Resolved (
              {reports?.filter((r: any) => r.status === "resolved").length || 0}
              )
            </Button>
          </Link>
          <Link href="/admin/reports?status=dismissed">
            <Button
              variant={status === "dismissed" ? "primary" : "outline"}
              size="sm"
            >
              Dismissed (
              {reports?.filter((r: any) => r.status === "dismissed").length ||
                0}
              )
            </Button>
          </Link>
        </div>
      </div>

      <ReportsList initialReports={reports} initialStatus={status} />
    </div>
  );
}
