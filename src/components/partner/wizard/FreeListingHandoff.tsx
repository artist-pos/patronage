"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { finalizeFreeListing } from "@/app/partner/opportunities/new/actions";
import { FREE_LISTING_DRAFT_KEY } from "@/lib/free-listing";

/**
 * Runs after a free-listing author signs in. Reads the draft they filled out
 * while logged out, creates a real owned listing from it, then drops them into
 * the normal wizard at the Basics step to add an image and publish.
 */
export function FreeListingHandoff() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(FREE_LISTING_DRAFT_KEY);
    } catch {
      raw = null;
    }

    // No saved draft — a logged-in partner landed here directly. Start fresh.
    if (!raw) {
      router.replace("/partner/opportunities/new?type=free");
      return;
    }

    let fields: Record<string, unknown> | null = null;
    try {
      fields = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      fields = null;
    }

    try {
      localStorage.removeItem(FREE_LISTING_DRAFT_KEY);
    } catch {
      /* ignore */
    }

    if (!fields) {
      router.replace("/partner/opportunities/new?type=free");
      return;
    }

    finalizeFreeListing(fields)
      .then((res) => {
        if (res.id) {
          router.replace(`/partner/opportunities/${res.id}/new?step=2&type=free`);
        } else {
          router.replace("/partner/opportunities/new?type=free");
        }
      })
      .catch(() => {
        router.replace("/partner/opportunities/new?type=free");
      });
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Finishing your listing…</p>
    </div>
  );
}
