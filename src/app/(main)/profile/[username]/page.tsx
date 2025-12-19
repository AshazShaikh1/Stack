import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { FeedGrid } from "@/components/feed/FeedGrid";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfileData } from "@/lib/services/profileService";
import { createClient } from "@/lib/supabase/server";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profileUser } = await supabase
    .from("users")
    .select("display_name, avatar_url")
    .eq("username", username)
    .single();

  if (!profileUser) {
    return generateSEOMetadata({
      title: "Not Found",
      description: "Profile not found",
    });
  }

  return generateSEOMetadata({
    title: `${profileUser.display_name} (@${username})`,
    description: `View profile on Stacq`,
    image: profileUser.avatar_url || undefined,
    url: `/profile/${username}`,
  });
}

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { username } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam || "collection";

  const data = await getProfileData(username, tab);

  if (!data) notFound();

  const { profile, isOwnProfile, feedItems } = data;

  return (
    <div className="container mx-auto px-4 md:px-page py-6 md:py-12 pb-24 md:pb-8">
      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />

      {/* Tabs (Scrollable) */}
      <div className="border-b border-gray-light mb-6 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-8 min-w-max">
          {[
            { id: "collection", label: "Collections" },
            { id: "card", label: "Cards" },
            { id: "saved", label: "Saved" },
          ].map((t) => (
            <a
              key={t.id}
              href={`/profile/${username}?tab=${t.id}`}
              className={`
                pb-3 px-1 border-b-2 transition-colors text-sm md:text-base font-medium whitespace-nowrap
                ${
                  tab === t.id ||
                  (tab === "created" && t.id === "collection") ||
                  (tab === "cards" && t.id === "card")
                    ? "border-emerald-600 text-jet-dark"
                    : "border-transparent text-gray-500 hover:text-jet-dark"
                }
              `}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      <FeedGrid items={feedItems} />
    </div>
  );
}
