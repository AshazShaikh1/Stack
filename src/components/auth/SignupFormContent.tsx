"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { trackEvent } from "@/lib/analytics";
import Image from "next/image";
import Link from "next/link";

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
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setProfilePicture(file);
    setError("");
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProfilePictureChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !username || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setStep(2);
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsOAuthLoading(true);

    try {
      const supabase = createClient();

      // Construct redirect URL safely
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      if (!origin) {
        setError("Unable to determine origin. Please refresh the page.");
        setIsOAuthLoading(false);
        return;
      }

      const redirectTo = `${origin}/auth/callback?next=/`;

      console.log("Initiating OAuth with redirectTo:", redirectTo);

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) {
        console.error("OAuth error:", oauthError);
        setError(
          oauthError.message ||
            "Failed to initiate Google sign-in. Please check your Supabase configuration."
        );
        setIsOAuthLoading(false);
      } else if (data?.url) {
        // OAuth URL generated successfully, redirect will happen automatically
        console.log("OAuth URL generated successfully");
      }
      // Note: User will be redirected to Google, so we don't need to handle success here
    } catch (err) {
      console.error("OAuth error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setIsOAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName) {
      setError("Display name is required");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("username", username.toLowerCase())
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 is "not found" which is what we want
        console.error("Error checking username:", checkError);
      }

      if (existingUser) {
        setError("Username is already taken. Please choose another one.");
        setIsLoading(false);
        return;
      }

      // Sign up the user with metadata for profile creation
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              username: username.toLowerCase(),
            },
          },
        }
      );

      if (signUpError) {
        // Provide more specific error messages
        let errorMessage = signUpError.message;
        if (signUpError.message.includes("email")) {
          errorMessage =
            "This email is already registered. Please sign in instead.";
        } else if (signUpError.message.includes("password")) {
          errorMessage =
            "Password is too weak. Please use a stronger password.";
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Wait for database trigger to create user profile
        // Poll for user profile to be created (max 3 seconds)
        let profileCreated = false;
        for (let i = 0; i < 30; i++) {
          const { data: userProfile } = await supabase
            .from("users")
            .select("id")
            .eq("id", authData.user.id)
            .single();

          if (userProfile) {
            profileCreated = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!profileCreated) {
          setError(
            "Profile creation failed. Please try again or contact support."
          );
          setIsLoading(false);
          return;
        }

        // Upload profile picture if provided
        if (profilePicture && authData.user && authData.session) {
          try {
            // Ensure we have a session before uploading
            const fileExt = profilePicture.name.split(".").pop();
            const fileName = `${authData.user.id}/${Date.now()}.${fileExt}`;

            // Use the session-aware client for upload
            const { error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(fileName, profilePicture, {
                cacheControl: "3600",
                upsert: false,
              });

            if (!uploadError) {
              const {
                data: { publicUrl },
              } = supabase.storage.from("avatars").getPublicUrl(fileName);

              // Update user profile with avatar URL
              const { error: updateError } = await supabase
                .from("users")
                .update({ avatar_url: publicUrl })
                .eq("id", authData.user.id);

              if (updateError) {
                console.error("Error updating avatar:", updateError);
                // Don't fail signup if avatar upload fails
              }
            } else {
              console.error("Error uploading avatar:", uploadError);
              // Don't fail signup if avatar upload fails
            }
          } catch (avatarError) {
            console.error("Avatar upload error:", avatarError);
            // Don't fail signup if avatar upload fails
          }
        }

        // Check if email confirmation is required
        if (authData.session) {
          // User is immediately signed in (email confirmation disabled)
          // Track signup event
          trackEvent.signup(authData.user.id, "email");
          if (isFullPage) {
            router.push("/");
            router.refresh();
          } else {
            onSuccess?.();
            // Force a hard navigation to ensure the page updates immediately
            window.location.href = "/";
          }
        } else {
          // Email confirmation required
          // Track signup event (even if email confirmation is needed)
          trackEvent.signup(authData.user.id, "email");
          // Show success message
          setError("");
          // Note: Toast will be shown by the parent component if useToast is available
          // For now, we'll show a success state that the parent can handle
          if (isFullPage) {
            router.push("/login");
          } else {
            onSuccess?.();
            onSwitchToLogin?.();
          }
        }
      } else {
        setError("User creation failed. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Signup error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <>
      {showLogo && (
        <div className="text-center mb-6">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-emerald rounded-lg flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-h2 font-bold text-jet-dark">Stacq</span>
          </div>

          {/* Welcome Text */}
          <h2 className="text-h2 font-semibold text-jet-dark mb-2">
            Welcome to Stacq
          </h2>
        </div>
      )}

      <div className="relative overflow-hidden">
        {/* Step 1: Email, Username, Password */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 1 ? "translate-x-0" : "-translate-x-full absolute inset-0"
          }`}
        >
          <form
            onSubmit={handleStep1Next}
            className="space-y-4 max-w-sm mx-auto"
          >
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="text"
              label="Username"
              placeholder="johndoe"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                )
              }
              required
              disabled={isLoading}
              helperText="Only letters, numbers, and underscores"
            />

            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              Continue
            </Button>
          </form>
        </div>

        {/* Step 2: Display Name and Profile Picture */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 2 ? "translate-x-0" : "translate-x-full absolute inset-0"
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
            <Input
              type="text"
              label="Display Name"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={isLoading}
            />

            <div className="w-full">
              <label className="block text-body font-medium text-jet-dark mb-2">
                Profile Picture
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
                  isDragging
                    ? "border-jet bg-jet/5"
                    : "border-gray-light hover:border-jet/50"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  id="profile-picture-upload"
                  disabled={isLoading}
                />
                <label
                  htmlFor="profile-picture-upload"
                  className="flex items-center gap-4 px-4 py-4 cursor-pointer"
                >
                  <div className="relative w-20 h-20 rounded-lg bg-gray-light flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profilePicturePreview ? (
                      <Image
                        src={profilePicturePreview}
                        alt="Profile preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-jet/20 flex items-center justify-center text-2xl font-bold text-jet">
                        {displayName.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {profilePicture ? (
                      <>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          {profilePicture.name}
                        </p>
                        <p className="text-small text-gray-muted">
                          Click or drag to change photo
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          Drag and drop a photo here
                        </p>
                        <p className="text-small text-gray-muted">
                          or click to browse
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>
              <p className="mt-1 text-small text-gray-muted">
                Optional - You can add this later. Files are saved to: Supabase
                Storage → avatars bucket → {`{user_id}`}/
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isLoading}
              >
                Create account
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-sm mx-auto mb-4">
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-light"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-muted">
              Or continue with email
            </span>
          </div>
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
        Continue with Google
      </Button>

      <div className="mt-6 text-center">
        <p className="text-body text-gray-muted">
          Already have an account?{" "}
          {isFullPage ? (
            <Link
              href="/login"
              className="text-jet font-medium hover:underline"
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={() => {
                onSwitchToLogin?.();
              }}
              className="text-jet font-medium hover:underline"
            >
              Sign in
            </button>
          )}
        </p>
      </div>
    </>
  );
}
