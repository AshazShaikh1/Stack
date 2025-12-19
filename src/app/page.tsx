import { createClient } from '@/lib/supabase/server';
import { LandingPage } from '@/components/landing/LandingPage';
import { FeedPage } from '@/components/feed/FeedPage';
import { generateMetadata } from "@/lib/seo";

export const metadata = generateMetadata({
  title: "Curate & Discover the Web",
  description: "Stacq is the place to save, organize, and share your favorite corners of the internet.",
  url: "/",
});

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If signed out, show landing page
  if (!user) {
    return <LandingPage />;
  }

  // If signed in, show feed (home) with cards and stacks
  return <FeedPage />;
}
