import { createClient } from '@/lib/supabase/server';
import { LandingPageButtonsProvider } from './LandingPageButtons';
import { LandingFooter } from './LandingFooter';
import { HowItWorksSection } from './HowItWorksSection';
import { TrendingSection } from './TrendingSection';
import { HeroSection } from './HeroSection';
import { CTASection } from './CTASection';

export async function LandingPage() {
  const supabase = await createClient();
  
  // Get trending collections (max 4)
  const { data: collections } = await supabase
    .from('collections')
    .select(`
      id,
      title,
      description,
      cover_image_url,
      owner_id,
      stats,
      owner:users!collections_owner_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('is_public', true)
    .eq('is_hidden', false)
    .order('stats->upvotes', { ascending: false })
    .limit(4);

  // Get trending cards (max 4) - order by upvotes/saves if available
  const { data: cards } = await supabase
    .from('cards')
    .select(`
      id,
      title,
      description,
      thumbnail_url,
      canonical_url,
      domain,
      metadata,
      saves_count,
      upvotes_count,
      created_by
    `)
    .eq('status', 'active')
    .order('saves_count', { ascending: false, nullsFirst: false })
    .order('upvotes_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(4);

  return (
    <LandingPageButtonsProvider>
      <div className="min-h-screen bg-cloud">
        {/* Hero Section */}
        <HeroSection />

        {/* How It Works Section */}
        <HowItWorksSection />

        {/* Trending Section */}
        <TrendingSection collections={collections || []} cards={cards || []} />

        {/* CTA Section */}
        <CTASection />

        {/* Footer */}
        <LandingFooter />
      </div>
    </LandingPageButtonsProvider>
  );
}
