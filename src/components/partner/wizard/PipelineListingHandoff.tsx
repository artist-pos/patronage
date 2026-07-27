"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { finalizePipelineListing } from "@/app/partner/opportunities/new/actions";
import { PIPELINE_LISTING_DRAFT_KEY } from "@/lib/pipeline-listing";
import type { TemplateKey } from "@/lib/pipeline-templates";

/**
 * Runs after a pipeline-listing author signs in. Reads the {opp, template}
 * draft they filled out (Template + Basics) while logged out, creates a real
 * owned listing from it, then drops them into the normal wizard at the Form
 * Builder step to finish setup and publish.
 */
export function PipelineListingHandoff() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PIPELINE_LISTING_DRAFT_KEY);
    } catch {
      raw = null;
    }

    // No saved draft — a logged-in partner landed here directly. Start fresh.
    if (!raw) {
      router.replace("/partner/opportunities/new?type=pipeline");
      return;
    }

    let parsed: { opp?: Record<string, unknown>; template?: TemplateKey } | null = null;
    try {
      parsed = JSON.parse(raw) as { opp?: Record<string, unknown>; template?: TemplateKey };
    } catch {
      parsed = null;
    }

    try {
      localStorage.removeItem(PIPELINE_LISTING_DRAFT_KEY);
    } catch {
      /* ignore */
    }

    if (!parsed) {
      router.replace("/partner/opportunities/new?type=pipeline");
      return;
    }

    finalizePipelineListing(parsed.opp ?? {}, parsed.template ?? null)
      .then((res) => {
        if (res.id) {
          router.replace(`/partner/opportunities/${res.id}/new?step=3&type=pipeline`);
        } else {
          router.replace("/partner/opportunities/new?type=pipeline");
        }
      })
      .catch(() => {
        router.replace("/partner/opportunities/new?type=pipeline");
      });
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Finishing your listing…</p>
    </div>
  );
}
