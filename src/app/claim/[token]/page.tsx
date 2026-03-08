import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Look up provenance link by claim token
  const { data: link } = await admin
    .from("provenance_links")
    .select("id, artwork_id, artist_id, patron_id, patron_email, status")
    .eq("claim_token", token)
    .single();

  if (!link) notFound();

  // Fetch artwork + artist for display
  const [{ data: artwork }, { data: artistProfile }] = await Promise.all([
    admin.from("artworks").select("url, caption, collection_label").eq("id", link.artwork_id).single(),
    admin.from("profiles").select("full_name, username").eq("id", link.artist_id).single(),
  ]);

  if (!artwork) notFound();

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "An artist";
  const workTitle = artwork.caption ?? "Untitled";

  // Check if already processed
  if (link.status === "verified") {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Already claimed</p>
        <p className="text-sm text-muted-foreground">This artwork has already been verified in a collection.</p>
        <Link href="/" className="text-sm underline underline-offset-2">Go to Patronage →</Link>
      </div>
    );
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Process the claim automatically — update the provenance link
    await admin
      .from("provenance_links")
      .update({ patron_id: user.id, patron_email: null, status: "pending" })
      .eq("id", link.id);

    redirect("/dashboard");
  }

  // Not logged in — show claim landing page
  const claimPath = `/claim/${token}`;

  return (
    <div className="max-w-sm mx-auto px-6 py-20 space-y-8">
      {/* Artwork preview */}
      <div className="border border-black overflow-hidden">
        <div className="relative w-full aspect-square bg-muted">
          <Image
            src={artwork.url}
            alt={workTitle}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
        <div className="px-4 py-3 border-t border-black">
          <p className="text-xs text-muted-foreground">
            {artwork.collection_label ?? "In collection"}
          </p>
          <p className="text-sm font-semibold">{workTitle}</p>
          <p className="text-xs text-muted-foreground">by {artistName}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <h1 className="text-base font-semibold">
          {artistName} has added this work to your collection on Patronage
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create a free account or sign in to confirm this work is in your collection and have it displayed on your profile.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={`/auth/signup?next=${encodeURIComponent(claimPath)}`}
            className="w-full bg-black text-white text-sm py-2.5 px-4 text-center hover:opacity-80 transition-opacity"
          >
            Create account →
          </Link>
          <Link
            href={`/auth/login?next=${encodeURIComponent(claimPath)}`}
            className="w-full border border-border text-sm py-2.5 px-4 text-center hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
