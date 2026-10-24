import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings, type RabobankSettings } from "@/lib/rabobank/settings";
import type { ArtistInvite, PartStatus } from "@/lib/rabobank/invites";
import { exGst, gstOf } from "@/lib/rabobank/quote";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from Supabase */

export interface SizeCost {
  fee: number | null; // excluding GST
  framing: number | null;
  framingSource: "artist" | "framer" | null;
  install: number | null;
  total: number | null; // indicative
}

export interface AdminArtistRow {
  invite: ArtistInvite;
  quote: any | null;
  artist: { id: string; name: string; visible: boolean; state: string | null; visibility_choice: string | null; photo_url: string | null; works: number } | null;
  deletion: { reason: string; deleted_at: string } | null;
  partOne: PartStatus;
  partTwo: PartStatus;
  sizes: { big: SizeCost; small: SizeCost };
}

function sizeCost(fee: number | null, q: any, framer: number | null): SizeCost {
  if (fee === null) return { fee: null, framing: null, framingSource: null, install: null, total: null };
  const own = q.framing_option === "self" && q.framing_cost !== null ? Number(q.framing_cost) : null;
  const framing = own ?? framer;
  const install = q.install_cost !== null && q.install_cost !== undefined ? Number(q.install_cost) : null;
  return {
    fee,
    framing,
    framingSource: own !== null ? "artist" : framer !== null ? "framer" : null,
    install,
    total: Math.round((fee + (framing ?? 0) + (install ?? 0)) * 100) / 100,
  };
}

export async function loadArtistAdmin(): Promise<{ rows: AdminArtistRow[]; settings: RabobankSettings }> {
  const admin = createAdminClient();
  const [settings, { data: invites }, { data: quotes }, { data: artists }, { data: works }, { data: deletions }] = await Promise.all([
    getSettings(),
    admin.from("rabobank_artist_invite").select("*").order("created_at", { ascending: true }),
    admin.from("rabobank_quote").select("*"),
    admin.from("rabobank_artist").select("id, name, visible, state, visibility_choice, photo_url, invite_id").not("invite_id", "is", null),
    admin.from("rabobank_work").select("artist_id"),
    admin.from("rabobank_deletion_log").select("invite_id, reason, deleted_at").order("deleted_at", { ascending: false }),
  ]);

  const workCount = new Map<string, number>();
  for (const w of works ?? []) workCount.set(w.artist_id, (workCount.get(w.artist_id) ?? 0) + 1);

  const rows = ((invites ?? []) as ArtistInvite[]).map((invite) => {
    const quote = (quotes ?? []).find((q) => q.invite_id === invite.id) ?? null;
    const a = (artists ?? []).find((x) => x.invite_id === invite.id) ?? null;
    const del = (deletions ?? []).find((d) => d.invite_id === invite.id) ?? null;
    const submitted = quote?.status === "submitted";
    const partOne: PartStatus = submitted && !quote?.draft ? "done" : quote ? "saved" : "not_started";
    const partTwo: PartStatus = a?.state && ["complete", "private_only", "kept"].includes(a.state) ? "done" : a ? "saved" : "not_started";
    const gst = submitted ? gstOf(quote) : null;
    const big = submitted ? exGst(quote.fee_1800x900 === null ? null : Number(quote.fee_1800x900), gst) : null;
    const small = submitted ? exGst(quote.fee_1600x800 === null ? null : Number(quote.fee_1600x800), gst) : null;
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      invite,
      quote,
      artist: a
        ? { id: a.id, name: a.name, visible: a.visible, state: a.state, visibility_choice: a.visibility_choice, photo_url: a.photo_url, works: workCount.get(a.id) ?? 0 }
        : null,
      deletion: del ? { reason: del.reason, deleted_at: del.deleted_at } : null,
      partOne,
      partTwo,
      sizes: {
        big: sizeCost(big, quote ?? {}, num(settings.framer_quote_1800x900)),
        small: sizeCost(small, quote ?? {}, num(settings.framer_quote_1600x800)),
      },
    };
  });
  return { rows, settings };
}
