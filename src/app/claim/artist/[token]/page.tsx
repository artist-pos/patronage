import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaimArtistButton } from "@/components/claim/ClaimArtistButton";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Claim your artist record — Patronage",
};

export default async function ArtistClaimPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: stub } = await admin
    .from("pending_artists")
    .select("id, name, email, claim_invite_email, claimed_by_profile_id")
    .eq("claim_token", token)
    .maybeSingle();

  if (!stub) notFound();

  // Pull the works currently attributed to this stub so the artist sees what
  // they'd be claiming before they confirm.
  const { data: artworks } = await admin
    .from("artworks")
    .select("id, title, url, year")
    .eq("attributed_pending_artist_id", stub.id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-stone-400">
            Claim invitation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stub.name}, are you on Patronage?
          </h1>
          <p className="text-sm text-muted-foreground">
            A collector has registered {(artworks ?? []).length} work
            {(artworks ?? []).length === 1 ? "" : "s"} attributed to you. If
            this is you, claim your records to review and confirm or decline
            each one.
          </p>
        </div>

        {stub.claimed_by_profile_id ? (
          <div className="border border-stone-200 rounded-lg p-6 bg-stone-50 text-sm">
            This claim has already been resolved.{" "}
            <Link href="/" className="underline">Go to Patronage →</Link>
          </div>
        ) : !user ? (
          <div className="border border-stone-200 rounded-lg p-6 bg-stone-50 space-y-3">
            <p className="text-sm font-medium">Sign in or create an account first</p>
            <p className="text-sm text-muted-foreground">
              We need to verify your email matches the one this invitation was
              sent to.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/auth/login?redirect=/claim/artist/${token}`}
                className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
              >
                Sign in
              </Link>
              <Link
                href={`/auth/signup?redirect=/claim/artist/${token}`}
                className="text-sm border border-stone-200 rounded-lg px-4 py-2 hover:bg-stone-50 transition-colors"
              >
                Create account
              </Link>
            </div>
          </div>
        ) : (
          <ClaimArtistButton token={token} />
        )}

        {(artworks ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-stone-500">
              Works pending your review
            </h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(artworks ?? []).map((art) => (
                <li key={art.id} className="space-y-2">
                  <div className="aspect-square bg-stone-100 rounded-md overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={art.url}
                      alt={art.title ?? ""}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs truncate">{art.title ?? "Untitled"}</p>
                  {art.year && (
                    <p className="text-[11px] text-muted-foreground">{art.year}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
