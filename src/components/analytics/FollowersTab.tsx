import Image from "next/image";
import Link from "next/link";
import { FollowerMessageButton } from "./FollowerMessageButton";
import type { FollowerProfile } from "@/lib/follows";

const ROLE_LABELS: Record<string, string> = {
  patron: "Patron",
  partner: "Partner",
  artist: "Artist",
  owner: "Artist",
  admin: "Admin",
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role || role === "artist" || role === "owner") return null;
  const label = ROLE_LABELS[role];
  if (!label) return null;
  return (
    <span className="text-[10px] border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none shrink-0">
      {label}
    </span>
  );
}

interface Props {
  followers: FollowerProfile[];
}

export function FollowersTab({ followers }: Props) {
  if (followers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">Your community is just beginning.</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {followers.map((f) => {
        const displayName = f.full_name ?? f.username;
        const followedDate = f.followed_at
          ? new Date(f.followed_at).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null;

        return (
          <div key={f.id} className="flex items-center gap-3 py-3">
            {/* Avatar */}
            <Link href={`/${f.username}`} className="shrink-0">
              {f.avatar_url ? (
                <div className="relative w-8 h-8 border border-black overflow-hidden rounded-full">
                  <Image
                    src={f.avatar_url}
                    alt={displayName}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 border border-black rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>

            {/* Name + role badge */}
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <Link
                href={`/${f.username}`}
                className="text-sm font-medium hover:underline underline-offset-2 truncate"
              >
                {displayName}
              </Link>
              <RoleBadge role={f.role} />
            </div>

            {/* Date followed — hidden on smallest screens */}
            {followedDate && (
              <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {followedDate}
              </span>
            )}

            {/* Message icon */}
            <FollowerMessageButton followerId={f.id} />
          </div>
        );
      })}
    </div>
  );
}
