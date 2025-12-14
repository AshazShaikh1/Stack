'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SearchIcon } from '@/components/ui/Icons';
import Image from "next/image";

export function MobileHeader() {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);

  // 1. Get safe user data
  const metadata = user?.user_metadata || {};
  const username = metadata.username || user?.id;
  const avatarUrl = metadata.avatar_url;
  
  // 2. Determine Initials (Fallback)
  // Tries: Display Name -> Username -> Email -> "U"
  const displayName = metadata.display_name || metadata.username || user?.email || 'U';
  const initial = displayName[0]?.toUpperCase() || 'U';

  // Reset error state when user changes
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-light z-40 px-4 flex items-center justify-between">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
          S
        </div>
        <span className="font-bold text-xl text-jet-dark tracking-tight">Stacq</span>
      </Link>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Mobile Search */}
        <Link href="/search" className="p-2 text-gray-muted hover:text-jet-dark transition-colors">
          <SearchIcon size={22} />
        </Link>

        {user ? (
          <Link href={`/profile/${username}`}>
            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
              {/* 3. Robust Image Rendering */}
              {avatarUrl && !imgError ? (
                <Image 
                  src={avatarUrl} 
                  alt={username} 
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)} // <-- The Fix: Switches to fallback on error
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald text-white text-xs font-bold">
                  {initial}
                </div>
              )}
            </div>
          </Link>
        ) : (
          <Link href="/login" className="px-4 py-1.5 rounded-full bg-emerald/10 text-emerald text-sm font-bold">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}