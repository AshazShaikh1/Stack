'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  email: string;
  role?: string;
}

interface AccountDropdownProps {
  user: any;
}

export function AccountDropdown({ user }: AccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showSuccess } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const supabase = createClient();
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, role')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile({
          ...data,
          email: user.email || '',
        });
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    showSuccess('Logged out successfully');
    window.location.href = '/';
  };

  if (isLoading || !profile) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-light animate-pulse" />
    );
  }

  const initials = profile.display_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {/* Profile Icon */}
        <Tooltip text="Profile" position="bottom">
          <Link
            href={`/profile/${profile.username}`}
            className="w-10 h-10 rounded-full bg-jet/20 flex items-center justify-center text-jet font-semibold hover:bg-jet/30 transition-colors relative"
            aria-label="Profile"
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                width={40}
                height={40}
                className="rounded-full"
                unoptimized
                onError={(e) => {
                  // Hide image on error and show initials
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.fallback-initials')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-initials w-full h-full flex items-center justify-center text-jet font-semibold text-sm';
                    fallback.textContent = initials;
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              initials
            )}
          </Link>
        </Tooltip>

        {/* Dropdown Arrow */}
        <Tooltip text="Your accounts" position="bottom">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-md hover:bg-gray-light transition-colors focus:outline-none"
            aria-label="Your accounts"
          >
            <svg
              className={`w-4 h-4 text-gray-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-light z-20 overflow-hidden">
            {/* Your Account */}
            <div className="p-4 border-b border-gray-light">
              <div className="text-small text-gray-muted mb-3">Your Account</div>
              <Link
                href={`/profile/${profile.username}`}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-light/50 transition-colors cursor-pointer"
              >
                <div className="flex-shrink-0 relative">
                  {profile.avatar_url ? (
                    <>
                      <Image
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.fallback-initials') as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            } else {
                              const div = document.createElement('div');
                              div.className = 'fallback-initials w-10 h-10 rounded-full bg-jet/20 flex items-center justify-center text-jet font-semibold text-sm';
                              div.textContent = initials;
                              parent.appendChild(div);
                            }
                          }
                        }}
                      />
                      <div className="fallback-initials hidden w-10 h-10 rounded-full bg-jet/20 text-jet font-semibold text-sm">
                        {initials}
                      </div>
                    </>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-jet/20 flex items-center justify-center text-jet font-semibold text-sm">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-jet-dark truncate">
                    {profile.display_name}
                  </div>
                  <div className="text-small text-gray-muted truncate">
                    @{profile.username}
                  </div>
                  <div className="text-small text-gray-muted truncate">
                    {profile.email}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-jet"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
              <div className="py-2 border-b border-gray-light">
              {(profile.role === 'stacker' || profile.role === 'admin') && (
                <Link
                  href="/stacker/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-light transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald/10 flex items-center justify-center flex-shrink-0">
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
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div className="text-body font-semibold text-jet-dark">
                    Dashboard
                  </div>
                </Link>
              )}
            </div>

            {/* Sign Out */}
            <div className="py-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-light transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gray-light flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-jet"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </div>
                <div className="text-body font-semibold text-jet-dark">
                  Log out
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleSignOut}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        cancelText="Cancel"
        variant="default"
      />
    </div>
  );
}

