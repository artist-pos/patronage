import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { findMatchingStubsForName } from "@/lib/artist-stub";
import { getPendingConfirmationsForArtist } from "@/lib/pending-confirmations";
import { PendingConfirmationsList } from "@/components/studio/PendingConfirmationsList";
import { StubMatchSuggestions } from "@/components/studio/StubMatchSuggestions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pending confirmations — Patronage",
};

export default async function PendingConfirmationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/studio/pending-confirmations");

  const profile = await getProfileById(user.id);

  // Run the confirmation fetch and the stub match in parallel — they don't
  // depend on each other and the studio sidebar shouldn't wait twice.
  const [confirmations, matchingStubs] = await Promise.all([
    getPendingConfirmationsForArtist(user.id),
    profile?.full_name ? findMatchingStubsForName(profile.full_name) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link
          href="/studio"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to studio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Pending confirmations</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Other people on Patronage have registered works they say you made.
          Confirm the ones that are yours, decline anything you don&rsquo;t
          recognise, or skip with &ldquo;I&rsquo;m not sure&rdquo; — you can
          come back later.
        </p>
      </div>

      {matchingStubs.length > 0 && (
        <StubMatchSuggestions stubs={matchingStubs} />
      )}

      {confirmations.length === 0 ? (
        <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing waiting on you. When a collector registers a work of
            yours, it&rsquo;ll show up here.
          </p>
        </div>
      ) : (
        <PendingConfirmationsList confirmations={confirmations} />
      )}
    </div>
  );
}
