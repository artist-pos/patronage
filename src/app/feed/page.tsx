import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getLatestUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import { InfiniteFeed } from "@/components/feed/InfiniteFeed";

export const metadata: Metadata = {
  title: "Studio Feed | Patronage",
  description: "Work in progress from the Patronage community.",
};

const INITIAL_COUNT = 10;

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;

  const [updates, userProjects] = await Promise.all([
    getLatestUpdates(INITIAL_COUNT),
    profile ? getArtistProjects(profile.id) : Promise.resolve([]),
  ]);

  const hasMore = updates.length === INITIAL_COUNT;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      <div className="space-y-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Studio Feed</h1>
          <p className="text-sm text-muted-foreground">Work in progress from the Patronage community.</p>
        </div>
        {profile && (
          <div className="flex justify-end">
            <CreateUpdateModal
              profileId={profile.id}
              label="New update +"
              className="w-auto px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
              projects={userProjects.map((p) => ({ id: p.id, title: p.title }))}
            />
          </div>
        )}
      </div>

      <hr className="border-t border-border" />

      <InfiniteFeed initialUpdates={updates} initialHasMore={hasMore} />
    </div>
  );
}
