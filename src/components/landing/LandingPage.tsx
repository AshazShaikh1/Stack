import { LandingPageButtonsProvider } from "./LandingPageButtons";
import { LandingFooter } from "./LandingFooter";
import { HowItWorksSection } from "./HowItWorksSection";
import { TrendingSection } from "./TrendingSection";
import { HeroSection } from "./HeroSection";
import { CTASection } from "./CTASection";
import { getExploreFeed } from "@/lib/services/exploreService";

export async function LandingPage() {
  // REUSE logic! No more manual queries here.
  // We use the "todayTrending" from explore service which is cached and smart.
  const { todayTrending } = await getExploreFeed();

  const collections = todayTrending
    .filter((i: any) => i.type === "collection")
    .slice(0, 4);
  const cards = todayTrending.filter((i: any) => i.type === "card").slice(0, 4);

  return (
    <LandingPageButtonsProvider>
      <div className="min-h-screen bg-cloud">
        <HeroSection />
        <HowItWorksSection />
        <TrendingSection collections={collections} cards={cards} />
        <CTASection />
        <LandingFooter />
      </div>
    </LandingPageButtonsProvider>
  );
}
