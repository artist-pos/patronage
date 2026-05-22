"use client";

import { useState } from "react";
import { nudgeReviewer } from "@/app/partner/dashboard/scoring/actions";
import type { OpportunityCollaborator } from "@/types/database";

interface Props {
  opportunityId: string;
  collaborators: OpportunityCollaborator[];
}

export function CommitteePanel({ opportunityId, collaborators }: Props) {
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  if (collaborators.length === 0) return null;

  async function handleNudge(profileId: string) {
    setNudging(profileId);
    await nudgeReviewer(opportunityId, profileId);
    setNudging(null);
    setNudged((prev) => new Set([...prev, profileId]));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest">Review committee</p>
      <div className="space-y-2">
        {collaborators.map((c) => {
          const profile = (c as unknown as { profiles?: { username?: string; full_name?: string; avatar_url?: string } }).profiles;
          const name = profile?.full_name ?? profile?.username ?? "Collaborator";
          const didNudge = nudged.has(c.profile_id);
          return (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-stone-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm truncate">{name}</p>
                  <p className="text-[11px] text-stone-400 capitalize">{c.role}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={nudging === c.profile_id || didNudge}
                onClick={() => handleNudge(c.profile_id)}
                className="text-[11px] border border-stone-200 px-2.5 py-1 hover:border-black transition-colors disabled:opacity-50 shrink-0"
              >
                {nudging === c.profile_id ? "Sending…" : didNudge ? "Sent ✓" : "Nudge"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
