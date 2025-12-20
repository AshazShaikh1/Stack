"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Loader } from "@/components/ui/Loader";
import { trackEvent } from "@/lib/analytics";
import Link from "next/link";

interface LoginFormContentProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  showLogo?: boolean;
  isFullPage?: boolean;
}

export function LoginFormContent({
  onSuccess,
  onSwitchToSignup,
  showLogo = true,
  isFullPage = false,
}: LoginFormContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); // <--- Prevents flicker

  const handleGoogleSignIn = async () => {
    setError("");
    setIsOAuthLoading(true);

    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      if (!origin) {
        setError("Unable to determine origin. Please refresh the page.");
        setIsOAuthLoading(false);
        return;
      }

      const next = searchParams?.get("next") || "/";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
        next
      )}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) throw oauthError;
      // User redirects to Google; loading state persists
    } catch (err: any) {
      console.error("OAuth error:", err);
      setError(err.message || "An unexpected error occurred");
      setIsOAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Analytics
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        trackEvent.login(user.id, "email");
      }

      // --- CRITICAL FLICKER FIX ---
      // 1. Show redirect loader immediately
      setIsRedirecting(true);

      // 2. Determine destination
      const next = searchParams?.get("next") || "/";

      if (isFullPage) {
        // Hard navigation ensures clean state for full pages
        router.push(next);
        router.refresh();
      } else {
        // For Modals: Refresh the server components (Landing -> Feed)
        // We do NOT call onSuccess() immediately to avoid closing the modal
        // and revealing the Landing page before it transforms.
        router.refresh();

        // Optional: Call onSuccess after a delay if you need to close the modal explicitly
        // But usually, the route change or UI update handles it.
        if (onSuccess) {
          setTimeout(onSuccess, 500);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
      setIsRedirecting(false);
    }
  };

  // 3. Show Loading State during transition
  if (isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[400px]">
        <Loader size="lg" />
        <p className="mt-4 text-gray-muted animate-pulse font-medium">
          Setting up your feed...
        </p>
      </div>
    );
  }

  return (
    <>
      {showLogo && (
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-emerald rounded-lg flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-h2 font-bold text-jet-dark">Stacq</span>
          </div>
          <h2 className="text-h2 font-semibold mb-2">Welcome back</h2>
          <p className="text-body text-gray-muted">
            Sign in to your account to continue
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading || isOAuthLoading}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading || isOAuthLoading}
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            href="/reset-password"
            className="text-small text-jet hover:underline ml-auto"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
          disabled={isOAuthLoading}
        >
          Sign in
        </Button>
      </form>

      <div className="relative my-5 max-w-sm mx-auto">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-light"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-muted">
            Or continue with
          </span>
        </div>
      </div>

      <div className="max-w-sm mx-auto">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={isOAuthLoading || isLoading}
          isLoading={isOAuthLoading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>
      </div>

      <div className="mt-6 text-center">
        <p className="text-body text-gray-muted">
          Don&apos;t have an account?{" "}
          <button
            onClick={() => onSwitchToSignup?.()}
            className="text-jet font-medium hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </>
  );
}
