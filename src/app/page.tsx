import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing/LandingPage';
import { HomeFeed } from '@/components/feed/HomeFeed';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If signed out, show landing page
  if (!user) {
    return <LandingPage />;
  }

  // If signed in, show feed (home) with cards and stacks
  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">Home</h1>
        <p className="text-body text-gray-muted">
          Discover curated resources from the community
        </p>
      </div>

      <HomeFeed />
    </div>
  );
}
