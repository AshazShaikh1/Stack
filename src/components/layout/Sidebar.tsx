'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { HomeIcon, FeedIcon, ExploreIcon, CreateIcon, ProfileIcon } from '@/components/ui/Icons';
import { Tooltip } from '@/components/ui/Tooltip';

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { href: '/', icon: HomeIcon, label: 'Home', auth: false },
    { href: '/feed', icon: FeedIcon, label: 'Feed', auth: true },
    { href: '/explore', icon: ExploreIcon, label: 'Explore', auth: false },
    { href: '/create', icon: CreateIcon, label: 'Create', auth: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.auth || user);

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-light flex flex-col items-center py-4 z-30">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <div className="w-10 h-10 bg-jet rounded-lg flex items-center justify-center text-white font-bold text-lg hover:opacity-90 transition-opacity">
          S
        </div>
      </Link>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-6">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const IconComponent = item.icon;
          return (
            <Tooltip key={item.href} text={item.label} position="right">
              <Link
                href={item.href}
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-jet text-white' 
                    : 'text-gray-muted hover:bg-gray-light hover:text-jet'
                  }
                `}
                aria-label={item.label}
              >
                <IconComponent size={20} />
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-4">
        {user && (
          <Tooltip text="Profile" position="right">
            <Link
              href={`/profile/${user.username || user.id}`}
              className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-muted hover:bg-gray-light hover:text-jet transition-all duration-200"
              aria-label="Profile"
            >
              <ProfileIcon size={20} />
            </Link>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}

