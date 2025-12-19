import { requireStacker } from "@/lib/auth/guards";
import { StackerDashboard } from "@/components/stacker/StackerDashboard";

export default async function StackerDashboardPage() {
  // 1. Centralized Auth Check & Profile Fetch
  const { profile } = await requireStacker();

  return (
    <div className="min-h-screen bg-cloud">
      <StackerDashboard user={profile} />
    </div>
  );
}
