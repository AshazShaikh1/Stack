"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  data: any;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  reporter?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface ReportsListProps {
  initialReports: Report[];
  initialStatus: string;
}

export function ReportsList({
  initialReports,
  initialStatus,
}: ReportsListProps) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [updating, setUpdating] = useState<string | null>(null);

  const updateReportStatus = async (
    reportId: string,
    newStatus: "resolved" | "dismissed"
  ) => {
    setUpdating(reportId);
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update report");
      }

      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report");
    } finally {
      setUpdating(null);
    }
  };

  const getTargetLink = (report: Report) => {
    switch (report.target_type) {
      case "collection":
      case "stack":
        return `/collection/${report.target_id}`;
      case "card":
        return `/card/${report.target_id}`;
      case "user":
        return `/profile/${report.target_id}`;
      default:
        return "#";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id} className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Header: User & Date */}
              <div className="flex items-center gap-3 mb-3">
                {report.reporter?.avatar_url ? (
                  <Image
                    src={report.reporter.avatar_url}
                    alt={report.reporter.display_name}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                    {report.reporter?.display_name?.charAt(0).toUpperCase() ||
                      "?"}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-jet-dark">
                    {report.reporter?.display_name || "Unknown User"}
                  </div>
                  <div className="text-xs text-gray-500">
                    @{report.reporter?.username || "unknown"} •{" "}
                    {formatDate(report.created_at)}
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium uppercase text-gray-600">
                    {report.target_type}
                  </span>
                  <Link
                    href={getTargetLink(report)}
                    target="_blank"
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    View Target ↗
                  </Link>
                </div>

                <p className="text-sm text-jet-dark font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                  <span className="text-red-500 font-bold block text-xs uppercase mb-1">
                    Reason
                  </span>
                  {report.reason}
                </p>

                {report.data && Object.keys(report.data).length > 0 && (
                  <details className="mt-2 text-xs text-gray-500 cursor-pointer">
                    <summary>View metadata</summary>
                    <pre className="mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(report.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            {/* Actions (Full width on mobile, right-aligned on desktop) */}
            {report.status === "open" ? (
              <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-none border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateReportStatus(report.id, "resolved")}
                  disabled={updating === report.id}
                  className="flex-1 md:flex-none justify-center text-emerald-600 hover:border-emerald-600 hover:bg-emerald-50"
                >
                  Resolve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateReportStatus(report.id, "dismissed")}
                  disabled={updating === report.id}
                  className="flex-1 md:flex-none justify-center text-gray-500"
                >
                  Dismiss
                </Button>
              </div>
            ) : (
              <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-500 self-start">
                {report.status}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
