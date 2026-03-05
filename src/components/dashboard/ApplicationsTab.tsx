"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { OpportunityApplication } from "@/types/database";
import { UploadHighResButton } from "./UploadHighResButton";

interface ApplicationWithOpportunity extends OpportunityApplication {
  opportunity: {
    id: string;
    title: string;
    organiser: string;
    type: string;
    deadline: string | null;
    profile_id: string | null;
    profiles: { full_name: string | null; username: string } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Received", className: "bg-muted text-muted-foreground" },
  shortlisted: { label: "Under Review", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  selected: { label: "Shortlisted", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  approved_pending_assets: { label: "Upload Required ⚠️", className: "bg-orange-50 text-orange-700 border border-orange-300" },
  production_ready: { label: "Approved ✓", className: "bg-green-50 text-green-700 border border-green-200" },
  rejected: { label: "Not Selected", className: "bg-muted text-muted-foreground" },
};

interface Props {
  initialApplications: ApplicationWithOpportunity[];
  userId: string;
}

export function ApplicationsTab({ initialApplications, userId }: Props) {
  const [applications, setApplications] = useState(initialApplications);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("applications-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "opportunity_applications",
          filter: `artist_id=eq.${userId}`,
        },
        (payload) => {
          setApplications((prev) =>
            prev.map((app) =>
              app.id === payload.new.id
                ? { ...app, ...(payload.new as Partial<ApplicationWithOpportunity>) }
                : app
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (applications.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">You haven&apos;t applied to any opportunities yet.</p>
        <Link
          href="/opportunities"
          className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
        >
          Browse Opportunities →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {applications.map((app) => {
        const opp = app.opportunity;
        const statusInfo = STATUS_LABELS[app.status] ?? STATUS_LABELS.pending;
        const partnerName = opp?.profiles?.full_name ?? opp?.profiles?.username ?? opp?.organiser ?? "Partner";

        return (
          <div
            key={app.id}
            className="border border-black p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                {opp ? (
                  <Link
                    href={`/opportunities/${opp.id}`}
                    className="font-semibold text-sm hover:underline truncate block"
                  >
                    {opp.title}
                  </Link>
                ) : (
                  <p className="font-semibold text-sm text-muted-foreground">Opportunity removed</p>
                )}
                <p className="text-xs text-muted-foreground">{partnerName}</p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 leading-none ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Applied {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</span>
              {opp?.deadline && (
                <span>Deadline {new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>
              )}
            </div>

            {app.status === "approved_pending_assets" && (
              <UploadHighResButton applicationId={app.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
