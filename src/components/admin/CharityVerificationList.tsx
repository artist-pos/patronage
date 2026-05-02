"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setDonationEnabled } from "@/app/admin/charity-verification/actions";
import type { Profile } from "@/types/database";

type Row = Pick<
  Profile,
  | "id"
  | "username"
  | "full_name"
  | "avatar_url"
  | "organisation_type"
  | "charitable_registration"
  | "donation_enabled"
  | "donation_url"
>;

interface Props {
  rows: Row[];
}

const NZ_REGISTER_URL = "https://www.charities.govt.nz/charities-in-new-zealand/the-charities-register/";

export function CharityVerificationList({ rows }: Props) {
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.id, r.donation_enabled])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(profileId: string, enabled: boolean) {
    setError(null);
    setEnabledById((prev) => ({ ...prev, [profileId]: enabled }));
    startTransition(async () => {
      const result = await setDonationEnabled(profileId, enabled);
      if (result.error) {
        setEnabledById((prev) => ({ ...prev, [profileId]: !enabled }));
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Verify against the public register:{" "}
        <a
          href={NZ_REGISTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          NZ Charities Commission
        </a>
        .
      </p>
      <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
        {rows.map((row) => {
          const enabled = enabledById[row.id];
          const displayName = row.full_name ?? row.username;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
              {row.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-stone-200" />
              )}

              <div className="flex-1 min-w-[220px]">
                <Link href={`/${row.username}`} className="text-sm font-medium hover:underline">
                  {displayName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Reg #: {row.charitable_registration ?? "—"}
                </p>
                {row.donation_url && (
                  <a
                    href={row.donation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-stone-700"
                  >
                    Donation URL ↗
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleToggle(row.id, !enabled)}
                disabled={isPending}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 ${
                  enabled
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-white border border-stone-200 hover:bg-stone-50"
                }`}
              >
                {enabled ? "Enabled — click to revoke" : "Approve donation CTA"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
