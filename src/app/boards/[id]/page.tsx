import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { hydrateBoardItems } from "@/lib/boards";
import { BoardView } from "@/components/boards/BoardView";
import type { Board, BoardItemType } from "@/types/database";

export const metadata: Metadata = { title: "Board" };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await getServerUser();
  if (!user) redirect(`/auth/login?redirect=/boards/${id}`);

  // RLS: only the owner can read a board here. Shared links use /b/[token].
  const { data: board } = await supabase.from("boards").select("*").eq("id", id).maybeSingle();
  if (!board) notFound();

  const [{ data: itemRows }, { data: me }] = await Promise.all([
    supabase
      .from("board_items")
      .select("item_type, item_id")
      .eq("board_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const tiles = await hydrateBoardItems(
    supabase,
    (itemRows ?? []) as Array<{ item_type: BoardItemType; item_id: string }>,
  );

  const isPartner = me?.role === "partner";
  let opportunities: Array<{ id: string; title: string; deadline: string | null }> = [];
  let invited: Array<{ opportunity_id: string; artist_id: string }> = [];
  if (isPartner && tiles.some((t) => t.type === "artist")) {
    const today = new Date().toISOString().slice(0, 10);
    const [oppsRes, invitesRes] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id, title, deadline")
        .or(`profile_id.eq.${user.id},organiser_profile_id.eq.${user.id}`)
        .eq("status", "published")
        .eq("is_active", true)
        .or(`deadline.gte.${today},deadline.is.null`)
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("opportunity_invites").select("opportunity_id, artist_id").eq("org_id", user.id),
    ]);
    opportunities = oppsRes.data ?? [];
    invited = invitesRes.data ?? [];
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <BoardView
        board={board as Board}
        tiles={tiles}
        shareUrl={`${SITE_URL}/boards/shared/${(board as Board).share_token}`}
        isPartner={isPartner}
        opportunities={opportunities}
        invited={invited}
      />
    </div>
  );
}
