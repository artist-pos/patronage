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

  const { data: followRows } = await supabase
    .from("follows")
    .select("follower_id, created_at")
    .eq("following_id", artistId)
    .order("created_at", { ascending: false });

  if (!followRows || followRows.length === 0) return [];

  const followerIds = followRows.map((r) => r.follower_id);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, role")
    .in("id", followerIds);

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

  return followRows.map((row) => {
    const profile = profileMap.get(row.follower_id);
    return {
      id: row.follower_id,
      username: profile?.username ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? null,
      followed_at: row.created_at,
    };
  });
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
