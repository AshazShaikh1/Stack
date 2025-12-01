'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (resetError) {
        setError(resetError.message);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-card p-8 text-center">
            <h1 className="text-h1 font-bold text-jet-dark mb-2">Check your email</h1>
            <p className="text-body text-gray-muted mb-6">
              We&apos;ve sent a password reset link to {email}
            </p>
            <Link href="/login">
              <Button variant="primary">Back to login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-card p-8">
          <h1 className="text-h1 font-bold text-jet-dark mb-2">Reset password</h1>
          <p className="text-body text-gray-muted mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-input text-small text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Send reset link
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-body text-jet font-medium hover:underline"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

