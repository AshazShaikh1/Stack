'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { trackEvent } from '@/lib/analytics';
import Link from 'next/link';

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
  isFullPage = false 
}: LoginFormContentProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsOAuthLoading(true);

    try {
      const supabase = createClient();
      
      // Construct redirect URL safely
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      if (!origin) {
        setError('Unable to determine origin. Please refresh the page.');
        setIsOAuthLoading(false);
        return;
      }

      const redirectTo = `${origin}/auth/callback?next=/`;
      
      console.log('Initiating OAuth with redirectTo:', redirectTo);
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        console.error('OAuth error:', oauthError);
        setError(oauthError.message || 'Failed to initiate Google sign-in. Please check your Supabase configuration.');
        setIsOAuthLoading(false);
      } else if (data?.url) {
        // OAuth URL generated successfully, redirect will happen automatically
        console.log('OAuth URL generated successfully');
      }
      // Note: User will be redirected to Google, so we don't need to handle success here
    } catch (err) {
      console.error('OAuth error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsOAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      // Get user ID for analytics
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        trackEvent.login(user.id, 'email');
      }

      // Success - handle navigation
      if (isFullPage) {
        router.push('/');
        router.refresh();
      } else {
        onSuccess?.();
        // Force a hard navigation to ensure the page updates immediately
        window.location.href = '/';
      }
    } catch (err) {
      setError('An unexpected error occurred');
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
          <h2 className="text-h2 font-semibold mb-2">
            Welcome back
          </h2>
          <p className="text-body text-gray-muted">
            Sign in to your account to continue
          </p>
        </div>
      )}

      <div className="max-w-sm mx-auto space-y-4">
        

        
        
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
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

        <div className="flex items-center justify-between">
          {isFullPage ? (
            <Link
              href="/reset-password"
              className="text-small text-jet hover:underline"
            >
              Forgot password?
            </Link>
          ) : (
            <a
              href="/reset-password"
              className="text-small text-jet hover:underline"
              onClick={(e) => {
                e.preventDefault();
                router.push('/reset-password');
              }}
            >
              Forgot password?
            </a>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isLoading}
        >
          Sign in
        </Button>
      </form>

      <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-light"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-muted">Or continue with email</span>
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
          Don&apos;t have an account?{' '}
          {isFullPage ? (
            <Link href="/signup" className="text-jet font-medium hover:underline">
              Sign up
            </Link>
          ) : (
            <button
              onClick={() => {
                onSwitchToSignup?.();
              }}
              className="text-jet font-medium hover:underline"
            >
              Sign up
            </button>
          )}
        </p>
      </div>
    </>
  );
}

