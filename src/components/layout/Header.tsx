'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CreateStackModal } from '@/components/stack/CreateStackModal';
import { SearchIcon } from '@/components/ui/Icons';

function CreateButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
        Create
      </Button>
      <CreateStackModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

function ProfileButton({ user }: { user: any }) {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      if (data) setUsername(data.username);
    };
    if (user) fetchUsername();
  }, [user]);

  if (!username) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-light animate-pulse" />
    );
  }

  return (
    <Link
      href={`/profile/${username}`}
      className="w-10 h-10 rounded-full bg-jet/20 flex items-center justify-center text-jet font-semibold hover:bg-jet/30 transition-colors"
      aria-label="Profile"
    >
      {user.email?.charAt(0).toUpperCase() || 'U'}
    </Link>
  );
}

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-light">
      <div className="container mx-auto px-page">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <form action="/search" method="get" className="w-full">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-light rounded-lg hover:bg-gray-light/80 transition-colors">
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
                <CreateButton />
                <ProfileButton user={user} />
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="primary" size="sm">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

