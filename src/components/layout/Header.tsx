'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SearchIcon } from '@/components/ui/Icons';
import { AccountDropdown } from './AccountDropdown';
import { NotificationDropdown } from './NotificationDropdown';

// Lazy load modals - only load when needed
const LoginModal = lazy(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })));
const SignupModal = lazy(() => import('@/components/auth/SignupModal').then(m => ({ default: m.SignupModal })));

export function Header() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-light">
      <div className="container mx-auto px-page">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <form action="/search" method="get" className="w-full">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-light rounded-lg hover:bg-gray-light/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald focus-within:border-emerald transition-all duration-200 border border-transparent">
                <SearchIcon size={18} className="text-gray-muted" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search stacks, cards, and stackers..."
                  className="flex-1 bg-transparent border-none outline-none text-body text-jet-dark placeholder:text-gray-muted"
                />
              </div>
            </form>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-20 h-10 bg-gray-light animate-pulse rounded-md" />
            ) : user ? (
              <>
                <NotificationDropdown user={user} />
                <AccountDropdown user={user} />
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsLoginOpen(true)}
                >
                  Sign in
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => setIsSignupOpen(true)}
                >
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoginOpen && (
        <Suspense fallback={null}>
          <LoginModal 
            isOpen={isLoginOpen} 
            onClose={() => setIsLoginOpen(false)}
            onSwitchToSignup={() => {
              setIsLoginOpen(false);
              setIsSignupOpen(true);
            }}
          />
        </Suspense>
      )}

      {isSignupOpen && (
        <Suspense fallback={null}>
          <SignupModal 
            isOpen={isSignupOpen} 
            onClose={() => setIsSignupOpen(false)}
            onSwitchToLogin={() => {
              setIsSignupOpen(false);
              setIsLoginOpen(true);
            }}
          />
        </Suspense>
      )}
    </header>
  );
}

