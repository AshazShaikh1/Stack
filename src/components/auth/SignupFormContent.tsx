"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Loader } from "@/components/ui/Loader";
import { motion, AnimatePresence } from "framer-motion";

interface SignupFormContentProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  showLogo?: boolean;
  isFullPage?: boolean;
}

export function SignupFormContent({
  onSuccess,
  onSwitchToLogin,
  showLogo = true,
  isFullPage = false,
}: SignupFormContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); // <--- Prevents flicker
  const [error, setError] = useState("");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Image State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Animation Variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsOAuthLoading(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const next = searchParams?.get("next") || "/";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
        next
      )}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsOAuthLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .ilike("username", usernameToCheck)
      .maybeSingle();

    if (error) return true; // Assume available on error
    return !data;
  };

  const checkEmailAvailability = async (emailToCheck: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("email")
      .eq("email", emailToCheck)
      .maybeSingle();

    if (error) return true;
    return !data;
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (step === 1) {
        if (!email || !username || !password)
          throw new Error("Please fill in all fields");
        if (password.length < 6)
          throw new Error("Password must be at least 6 characters");

        const [isUsernameAvailable, isEmailAvailable] = await Promise.all([
          checkUsernameAvailability(username),
          checkEmailAvailability(email),
        ]);

        if (!isUsernameAvailable) throw new Error("Username is already taken");
        if (!isEmailAvailable)
          throw new Error("Email is already registered. Please sign in.");

        setIsLoading(false);
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) {
      setError("Display name is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // 1. Sign Up
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: displayName },
        },
      });

      if (signupError) throw signupError;

      if (data.user && data.session) {
        // 2. Upload Avatar
        if (avatarFile) {
          const fileExt = avatarFile.name.split(".").pop();
          const fileName = `${data.user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, avatarFile, { upsert: true });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from("avatars")
              .getPublicUrl(fileName);

            await supabase.auth.updateUser({
              data: { avatar_url: publicData.publicUrl },
            });
          }
        }

        // --- CRITICAL FLICKER FIX ---
        // 3. Show redirect loader immediately
        setIsRedirecting(true);

        const next = searchParams?.get("next") || "/";

        if (isFullPage) {
          router.push(next);
          router.refresh();
        } else {
          // Reloads the underlying page (Landing -> Feed) before modal closes
          router.refresh();
          if (onSuccess) {
            setTimeout(onSuccess, 500);
          }
        }
      } else {
        // Fallback (Email confirmation required)
        setError("Account created. Please check email to verify.");
        setTimeout(() => {
          if (onSwitchToLogin) onSwitchToLogin();
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Show Loading State during transition
  if (isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[400px]">
        <Loader size="lg" />
        <p className="mt-4 text-gray-muted animate-pulse font-medium">
          Creating your profile...
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-white flex flex-col items-center ${
        isFullPage ? "min-h-screen justify-center px-4" : "p-1"
      }`}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          {showLogo && (
            <div className="flex items-center gap-2 justify-center mb-4">
              <div className="w-10 h-10 bg-emerald rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
                S
              </div>
              <span className="text-2xl font-bold text-jet-dark">Stacq</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-jet-dark">
            {step === 1 ? "Create your account" : "Additional details"}
          </h2>
          <p className="text-sm text-gray-muted mt-1">
            {step === 1
              ? "Start curating your internet"
              : "Tell us a bit about yourself"}
          </p>
        </div>

        <div className="relative overflow-hidden min-h-[320px]">
          <AnimatePresence initial={false} custom={step} mode="wait">
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                className="w-full"
              >
                <form onSubmit={handleContinue} className="space-y-4">
                  <Input
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={isLoading || isOAuthLoading}
                  />

                  <Input
                    type="text"
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    required
                    disabled={isLoading || isOAuthLoading}
                  />

                  <PasswordInput
                    id="signup-pass"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    disabled={isLoading || isOAuthLoading}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full justify-center py-3 text-base bg-emerald hover:bg-emerald-dark mt-6"
                    isLoading={isLoading}
                    disabled={isOAuthLoading}
                  >
                    Continue
                  </Button>
                </form>

                {/* Google Sign In (Step 1) */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-light"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-muted">
                      Or join with
                    </span>
                  </div>
                </div>

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
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                className="w-full"
              >
                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-2 group cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        disabled={isLoading}
                      />
                      <div
                        className={`w-full h-full rounded-full overflow-hidden border-2 ${
                          error ? "border-red-500" : "border-gray-200"
                        } group-hover:border-emerald transition-colors relative bg-gray-50 flex items-center justify-center`}
                      >
                        {avatarPreview ? (
                          <Image
                            src={avatarPreview}
                            alt="Preview"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-4xl text-gray-300 group-hover:text-emerald-400 transition-colors">
                            +
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md border border-gray-100">
                        <svg
                          className="w-4 h-4 text-emerald"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      Add profile photo (optional)
                    </p>
                  </div>

                  <Input
                    type="text"
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    autoFocus
                    disabled={isLoading}
                  />

                  <div className="space-y-3 mt-6">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full justify-center py-3 text-base bg-emerald hover:bg-emerald-dark"
                      isLoading={isLoading}
                    >
                      Create Account
                    </Button>

                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full text-sm text-gray-500 hover:text-jet-dark transition-colors py-2"
                      disabled={isLoading}
                    >
                      ← Back
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center animate-pulse">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="text-center text-sm text-gray-muted mt-6">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onSwitchToLogin?.()}
              className="text-emerald font-semibold hover:underline"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
