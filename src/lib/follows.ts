import { createClient } from "@/lib/supabase/server";

export interface FollowerProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  followed_at: string;
}

export async function getFollowers(artistId: string): Promise<FollowerProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select(`
      follower_id,
      created_at,
      profiles!follows_follower_id_fkey (
        username,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq("following_id", artistId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    id: row.follower_id,
    username: row.profiles?.username ?? "",
    full_name: row.profiles?.full_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    role: row.profiles?.role ?? null,
    followed_at: row.created_at,
  }));
}

export async function getFollowerCount(artistId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", artistId);
  return count ?? 0;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}
