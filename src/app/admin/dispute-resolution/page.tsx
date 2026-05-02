import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { DisputeResolutionList } from "@/components/admin/DisputeResolutionList";
import type {
  Artwork,
  HolderAttributionClaim,
  Profile,
} from "@/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dispute resolution — Patronage admin",
};

interface AppealRow {
  claim: HolderAttributionClaim;
  artwork: Artwork;
  holder: Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;
  artist: Pick<Profile, "id" | "username" | "full_name" | "avatar_url"> | null;
  evidenceSignedUrl: string | null;
}

export default async function DisputeResolutionPage() {
  if (!(await isAdmin())) redirect("/");

  const admin = createAdminClient();
  const { data: claims } = await admin
    .from("holder_attribution_claims")
    .select("*")
    .not("decline_appealed_at", "is", null)
    .eq("status", "declined")
    .order("decline_appealed_at", { ascending: false });

  const rows: AppealRow[] = [];
  for (const c of (claims ?? []) as HolderAttributionClaim[]) {
    // Parallel fetches per row are fine — admin queue is low volume.
    const [{ data: artwork }, { data: holder }, artistRes] = await Promise.all([
      admin.from("artworks").select("*").eq("id", c.artwork_id).maybeSingle(),
      admin
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", c.holder_id)
        .maybeSingle(),
      c.target_profile_id
        ? admin
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .eq("id", c.target_profile_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!artwork || !holder) continue;

    let evidenceSignedUrl: string | null = null;
    if (c.decline_appeal_evidence) {
      const { data } = await admin.storage
        .from("artwork-source-documents")
        .createSignedUrl(c.decline_appeal_evidence, 3600);
      evidenceSignedUrl = data?.signedUrl ?? null;
    }

    rows.push({
      claim: c,
      artwork: artwork as Artwork,
      holder,
      artist: artistRes.data ?? null,
      evidenceSignedUrl,
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Dispute resolution</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Holders appealing an artist&rsquo;s decline. Resolve narrowly:
          override to confirmed only when the artist&rsquo;s decline is
          clearly procedural (estate mistake, forgotten transfer). Otherwise
          uphold the decline or use &ldquo;Resolved by Patronage&rdquo; when
          the truth is genuinely unclear.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground">No appeals pending.</p>
        </div>
      ) : (
        <DisputeResolutionList rows={rows} />
      )}
    </div>
  );
}
