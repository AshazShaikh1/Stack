"use client";

import { Suspense } from "react";
import { SignupFormContent } from "@/components/auth/SignupFormContent";
import { Loader } from "@/components/ui/Loader"; // <--- Import

export default function SignupPage() {
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
            <SignupFormContent isFullPage={true} showLogo={true} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
