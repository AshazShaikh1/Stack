'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Sign up the user with metadata for profile creation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            username: username.toLowerCase(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Profile will be created automatically by database trigger
        // The trigger uses the metadata we passed in signUp options
        
        // Check if email confirmation is required
        if (authData.session) {
          // User is immediately signed in (email confirmation disabled)
          // Wait a moment for trigger to complete, then redirect
          await new Promise(resolve => setTimeout(resolve, 1000));
          router.push('/feed');
          router.refresh();
        } else {
          // Email confirmation required
          // Show success message
          setError('');
          alert('Account created! Please check your email to confirm your account before signing in.');
          router.push('/login');
        }
      } else {
        setError('User creation failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-card p-8">
          <h1 className="text-h1 font-bold text-jet-dark mb-2">Create account</h1>
          <p className="text-body text-gray-muted mb-6">
            Sign up to start curating resources
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Display Name"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="text"
              label="Username"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              disabled={isLoading}
              helperText="Only letters, numbers, and underscores"
            />

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
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              Create account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-body text-gray-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-jet font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

