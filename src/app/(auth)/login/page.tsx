import { Suspense } from "react";
import { LoginFormContent } from "@/components/auth/LoginFormContent";
import { Loader } from "@/components/ui/Loader";
import { generateMetadata } from "@/lib/seo";

export const metadata = generateMetadata({
  title: "Login",
  description: "Sign in to your account",
  noIndex: true, // <--- Enforced
});

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-card p-8">
          <Suspense
            fallback={
              <div className="flex justify-center p-8">
                <Loader />
              </div>
            }
          >
            <LoginFormContent isFullPage={true} showLogo={true} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
