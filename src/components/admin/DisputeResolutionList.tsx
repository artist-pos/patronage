"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adminResolveAppeal } from "@/app/admin/dispute-resolution/actions";
import type {
  Artwork,
  HolderAttributionClaim,
  Profile,
} from "@/types/database";

interface AppealRow {
  claim: HolderAttributionClaim;
  artwork: Artwork;
  holder: Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;
  artist: Pick<Profile, "id" | "username" | "full_name" | "avatar_url"> | null;
  evidenceSignedUrl: string | null;
}

interface Props {
  rows: AppealRow[];
}

export function DisputeResolutionList({ rows }: Props) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  return (
    <ul className="space-y-6">
      {rows
        .filter((r) => !resolved.has(r.claim.id))
        .map((row) => (
          <AppealCard
            key={row.claim.id}
            row={row}
            onResolved={() =>
              setResolved((prev) => new Set(prev).add(row.claim.id))
            }
          />
        ))}
    </ul>
  );
}

function AppealCard({
  row,
  onResolved,
}: {
  row: AppealRow;
  onResolved: () => void;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const thumb = row.artwork.url;

  function handleResolve(
    decision: "uphold_decline" | "override_to_confirmed" | "resolved_by_patronage",
  ) {
    setError(null);
    startTransition(async () => {
      const result = await adminResolveAppeal(row.claim.id, decision, adminNote);
      if (result.error) {
        setError(result.error);
        return;
      }
      onResolved();
    });
  }

  return (
    <li className="border border-stone-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
      <div className="aspect-square bg-stone-100 rounded-md overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={row.artwork.title ?? ""} className="w-full h-full object-cover" />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">
            {row.artwork.title ?? "Untitled"}
            {row.artwork.year && (
              <span className="text-stone-500 font-normal"> · {row.artwork.year}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Holder:{" "}
            <Link href={`/${row.holder.username}`} className="hover:underline">
              {row.holder.full_name ?? row.holder.username}
            </Link>
            {row.artist && (
              <>
                {" · "}
                Targeted artist:{" "}
                <Link href={`/${row.artist.username}`} className="hover:underline">
                  {row.artist.full_name ?? row.artist.username}
                </Link>
              </>
            )}
          </p>
        </div>

        {row.claim.decline_reason && (
          <div className="bg-red-50 border border-red-100 rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-red-700 mb-1">
              Artist&rsquo;s decline reason
            </p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">
              {row.claim.decline_reason}
            </p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700 mb-1">
            Holder&rsquo;s appeal
          </p>
          <p className="text-sm text-stone-700 whitespace-pre-wrap">
            {row.claim.decline_appeal_message ?? "(No message)"}
          </p>
          {row.evidenceSignedUrl && (
            <a
              href={row.evidenceSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs underline text-stone-700 hover:text-stone-900"
            >
              View evidence file →
            </a>
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Resolution note (visible internally)</span>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
          />
        </label>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleResolve("uphold_decline")}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-60"
          >
            Uphold decline
          </button>
          <button
            type="button"
            onClick={() => handleResolve("resolved_by_patronage")}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            Resolved by Patronage
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Override the artist's decline and confirm this record? Use only when the decline was clearly procedural.",
                )
              ) {
                handleResolve("override_to_confirmed");
              }
            }}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            Override to confirmed
          </button>
        </div>
      </div>
    </li>
  );
}
