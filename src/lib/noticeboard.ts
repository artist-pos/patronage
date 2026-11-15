import { createClient } from "@/lib/supabase/server";
import { DISCIPLINE_TO_MEDIUM } from "@/lib/disciplines";
import type { DisciplineEnum, NoticeKind, NoticeReply, NoticeWithAuthor } from "@/types/database";

const NOTICE_SELECT = `
  id, author_id, kind, body, region_id, created_at, expires_at, sorted_at, admin_hidden,
  author:profiles!notices_author_id_fkey (username, full_name, role, disciplines),
  region:regions!notices_region_id_fkey (name)
`;

type Row = {
  id: string; author_id: string; kind: NoticeKind; body: string; region_id: string | null;
  created_at: string; expires_at: string; sorted_at: string | null; admin_hidden: boolean;
  author: { username: string; full_name: string | null; role: string | null; disciplines: DisciplineEnum[] | null } | null;
  region: { name: string } | null;
};

function roleLabel(a: Row["author"]): string | null {
  if (!a) return null;
  if (a.role === "partner") return "Organisation";
  const d = a.disciplines?.[0];
  return d ? DISCIPLINE_TO_MEDIUM[d] ?? null : null;
}

async function withLastReply(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Row[],
): Promise<NoticeWithAuthor[]> {
  const ids = rows.map((r) => r.id);
  const last = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .from("notice_replies")
      .select("notice_id, created_at")
      .in("notice_id", ids)
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    for (const r of (data ?? []) as { notice_id: string; created_at: string }[]) {
      if (!last.has(r.notice_id)) last.set(r.notice_id, r.created_at);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    author_id: r.author_id,
    kind: r.kind,
    body: r.body,
    region_id: r.region_id,
    created_at: r.created_at,
    expires_at: r.expires_at,
    sorted_at: r.sorted_at,
    admin_hidden: r.admin_hidden,
    author_name: r.author?.full_name ?? r.author?.username ?? "Someone",
    author_username: r.author?.username ?? "",
    author_role_label: roleLabel(r.author),
    region_name: r.region?.name ?? null,
    last_reply_at: last.get(r.id) ?? null,
  }));
}

/**
 * Live notices, newest first, with the viewer's region first when given.
 * RLS (227) already limits rows to live notices plus the viewer's own; this
 * also drops the viewer's own sorted or expired ones from public lists.
 */
export async function getNotices(opts: {
  regionFirstId?: string | null;
  regionId?: string | null;
  kind?: NoticeKind | null;
  limit?: number;
} = {}): Promise<NoticeWithAuthor[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notices")
    .select(NOTICE_SELECT)
    .is("sorted_at", null)
    .eq("admin_hidden", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.kind) query = query.eq("kind", opts.kind);
  if (opts.regionId) query = query.eq("region_id", opts.regionId);
  const { data } = await query;
  let rows = (data ?? []) as unknown as Row[];
  if (opts.regionFirstId) {
    const id = opts.regionFirstId;
    rows = [...rows.filter((r) => r.region_id === id), ...rows.filter((r) => r.region_id !== id)];
  }
  return withLastReply(supabase, rows);
}

export async function getNoticeById(id: string): Promise<NoticeWithAuthor | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("notices").select(NOTICE_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const [notice] = await withLastReply(supabase, [data as unknown as Row]);
  return notice;
}

/** Replies in order. RLS shows hidden ones only to their author and the poster. */
export async function getNoticeReplies(noticeId: string): Promise<NoticeReply[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notice_replies")
    .select("id, notice_id, author_id, body, hidden, created_at, author:profiles!notice_replies_author_id_fkey (username, full_name)")
    .eq("notice_id", noticeId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as (Omit<NoticeReply, "author_name" | "author_username"> & { author: { username: string; full_name: string | null } | null })[]).map((r) => ({
    id: r.id,
    notice_id: r.notice_id,
    author_id: r.author_id,
    body: r.body,
    hidden: r.hidden,
    created_at: r.created_at,
    author_name: r.author?.full_name ?? r.author?.username ?? "Someone",
    author_username: r.author?.username ?? "",
  }));
}
