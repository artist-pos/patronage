import type { Profile } from "@/types/database";

export interface BadgeSet {
  withPatronage: boolean;  // profile.is_patronage_supported
  verified: boolean;       // bio + avatar + 3+ artworks
  exhibited: boolean;      // exhibition_history.length > 0
  grantRecipient: boolean; // received_grants.length > 0
  collected: boolean;      // has works transferred to another owner
}

export function computeBadges(
  profile: Pick<Profile, "is_patronage_supported" | "bio" | "avatar_url" | "exhibition_history" | "received_grants">,
  worksCount: number,
  isCollected: boolean
): BadgeSet {
  return {
    withPatronage: profile.is_patronage_supported,
    verified: !!(profile.bio && profile.avatar_url && worksCount >= 3),
    exhibited: (profile.exhibition_history ?? []).length > 0,
    grantRecipient: (profile.received_grants ?? []).length > 0,
    collected: isCollected,
  };
}
