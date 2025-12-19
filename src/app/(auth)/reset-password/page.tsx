// NO "use client" here! This must be a Server Component.

import { generateMetadata as constructMetadata } from "@/lib/seo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

// Now this works perfectly
export const metadata = constructMetadata({
  title: "Reset Password",
  description: "Reset your account password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
      {/* Render the client component */}
      <ResetPasswordForm />
    </div>
  );
}
