'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LoginModal } from '@/components/auth/LoginModal';
import { SignupModal } from '@/components/auth/SignupModal';

export function LandingHeader() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-light">
        <div className="container mx-auto px-page">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-emerald rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-button group-hover:scale-105 transition-transform duration-200">
                S
              </div>
              <span className="text-h2 font-bold text-jet-dark group-hover:text-emerald transition-colors duration-200">Stacq</span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              <Link 
                href="/explore" 
                className="text-body text-gray-muted hover:text-emerald transition-colors duration-200 relative group"
              >
                Explore
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-emerald group-hover:w-full transition-all duration-200"></span>
              </Link>
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
            </nav>
          </div>
        </div>
      </header>

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)}
        onSwitchToSignup={() => setIsSignupOpen(true)}
      />
      <SignupModal 
        isOpen={isSignupOpen} 
        onClose={() => setIsSignupOpen(false)}
        onSwitchToLogin={() => setIsLoginOpen(true)}
      />
    </>
  );
}

