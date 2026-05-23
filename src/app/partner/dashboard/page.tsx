import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Dashboard — Patronage",
};

const STATUS_COLOURS: Record<string, string> = {
  pending:                 "bg-amber-400",
  shortlisted:             "bg-black",
  selected:                "bg-emerald-500",
  approved_pending_assets: "bg-blue-400",
  production_ready:        "bg-violet-500",
  rejected:                "bg-stone-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending:                 "new",
  shortlisted:             "shortlisted",
  selected:                "selected",
  approved_pending_assets: "in production",
  production_ready:        "production-ready",
  rejected:                "rejected",
};

const STATUS_ORDER = ["pending", "shortlisted", "selected", "approved_pending_assets", "production_ready", "rejected"];

const LEGEND = [
  { key: "pending",                 label: "New",              colour: "bg-amber-400"   },
  { key: "shortlisted",             label: "Shortlisted",      colour: "bg-black"       },
  { key: "selected",                label: "Selected",         colour: "bg-emerald-500" },
  { key: "approved_pending_assets", label: "Pending assets",   colour: "bg-blue-400"   },
  { key: "production_ready",        label: "Production-ready", colour: "bg-violet-500"  },
  { key: "rejected",                label: "Rejected",         colour: "bg-stone-300"   },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length || data.every((v) => v === 0)) return null;
  const max = Math.max(...data, 1);
  const W = 60, H = 28, pts = data.length;
  const points = data.map((v, i) => {
    const x = (i / (pts - 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      <polyline points={points} fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const [{ data: { user } }] = await Promise.all([supabase.auth.getUser()]);
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, username")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;
  if (userRole !== "partner" && userRole !== "admin" && userRole !== "owner") redirect("/");

  const isAdminUser = userRole === "admin" || userRole === "owner";
  const displayName = profile?.full_name ?? profile?.username ?? "there";

  let collaboratorOppIds: string[] = [];
  if (!isAdminUser) {
    const { data: collabRows } = await supabase
      .from("opportunity_collaborators")
      .select("opportunity_id")
      .eq("profile_id", user.id);
    collaboratorOppIds = (collabRows ?? []).map((r: { opportunity_id: string }) => r.opportunity_id);
  }

  let [{ data: opportunities }, { data: submissions }, { data: allListings }]: [
    { data: unknown[] | null },
    { data: unknown[] | null },
    { data: unknown[] | null },
  ] = [{ data: [] }, { data: [] }, { data: [] }];

  if (isAdminUser) {
    [{ data: opportunities }, { data: submissions }, { data: allListings }] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, city, country, funding_range, profiles!opportunities_profile_id_fkey(full_name, username)")
        .eq("routing_type", "pipeline")
        .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, status, routing_type, created_at")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
        .order("created_at", { ascending: false }),
    ]);
  } else {
    const ownOrCollab = collaboratorOppIds.length > 0
      ? `profile_id.eq.${user.id},id.in.(${collaboratorOppIds.join(",")})`
      : undefined;

    [{ data: opportunities }, { data: submissions }, { data: allListings }] = await Promise.all([
      ownOrCollab
        ? supabase
            .from("opportunities")
            .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, city, country, funding_range, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("routing_type", "pipeline")
            .or(ownOrCollab)
            .order("created_at", { ascending: false })
        : supabase
            .from("opportunities")
            .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, city, country, funding_range, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("routing_type", "pipeline")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, status, routing_type, created_at")
        .eq("profile_id", user.id)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
      ownOrCollab
        ? supabase
            .from("opportunities")
            .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .or(ownOrCollab)
            .order("created_at", { ascending: false })
        : supabase
            .from("opportunities")
            .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false }),
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oppIds = (opportunities ?? []).map((o: any) => o.id);

  const { data: appCounts } = oppIds.length > 0
    ? await supabase
        .from("opportunity_applications")
        .select("opportunity_id, status, created_at")
        .in("opportunity_id", oppIds)
    : { data: [] };

  // Build date buckets for sparklines (last 14 days)
  const SPARKLINE_DAYS = 14;
  const now = Date.now();
  const dayMs = 86400000;
  const bucketStart = now - SPARKLINE_DAYS * dayMs;

  const countMap = new Map<string, {
    total: number; pending: number; shortlisted: number; selected: number;
    byStatus: Record<string, number>;
    lastAppAt: string | null;
    dailyBuckets: number[];
  }>();
  for (const app of appCounts ?? []) {
    const a = app as { opportunity_id: string; status: string; created_at: string };
    if (!countMap.has(a.opportunity_id)) {
      countMap.set(a.opportunity_id, {
        total: 0, pending: 0, shortlisted: 0, selected: 0,
        byStatus: {}, lastAppAt: null,
        dailyBuckets: Array(SPARKLINE_DAYS).fill(0),
      });
    }
    const entry = countMap.get(a.opportunity_id)!;
    entry.total++;
    entry.byStatus[a.status] = (entry.byStatus[a.status] ?? 0) + 1;
    if (a.status === "pending") entry.pending++;
    if (a.status === "shortlisted") entry.shortlisted++;
    if (["selected", "approved_pending_assets", "production_ready"].includes(a.status)) entry.selected++;
    if (!entry.lastAppAt || a.created_at > entry.lastAppAt) entry.lastAppAt = a.created_at;
    const appTime = new Date(a.created_at).getTime();
    if (appTime >= bucketStart) {
      const idx = Math.floor((appTime - bucketStart) / dayMs);
      if (idx >= 0 && idx < SPARKLINE_DAYS) entry.dailyBuckets[idx]++;
    }
  }

  // KPI aggregates
  const allApps = appCounts ?? [];
  const totalReceived = allApps.length;
  const totalReviewed = allApps.filter((a) => {
    const s = (a as { status: string }).status;
    return s !== "pending";
  }).length;
  const totalSelected = allApps.filter((a) => {
    const s = (a as { status: string }).status;
    return ["selected", "approved_pending_assets", "production_ready"].includes(s);
  }).length;
  const acceptanceRate = totalReceived > 0 ? Math.round((totalSelected / totalReceived) * 100) : 0;

  // Needs attention: pending opps in review or rejections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsAttention = (submissions as any[] ?? []).filter((s: any) => s.status === "rejected");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingReview = (submissions as any[] ?? []).filter((s: any) => s.status === "pending");

  const hasPipelines = opportunities && (opportunities as unknown[]).length > 0;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-10 space-y-10">

      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Partner dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight">Kia ora, {displayName.split(" ")[0]}</h1>
          {isAdminUser && (
            <p className="text-sm text-stone-500">Admin view — all partner pipelines across the platform.</p>
          )}
        </div>
        <Link
          href="/partners"
          className="shrink-0 bg-black text-white text-sm px-5 py-2.5 hover:bg-black/80 transition-colors font-medium"
        >
          + New listing
        </Link>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      {hasPipelines && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Applications received" value={totalReceived} />
          <KpiCard label="Reviewed" value={totalReviewed} />
          <KpiCard label="Acceptance rate" value={`${acceptanceRate}%`} />
          <KpiCard label="Active pipelines" value={(opportunities as unknown[]).length} />
        </div>
      )}

      {/* ── Pipeline rows ────────────────────────────────────────────────────── */}
      {hasPipelines && (
        <div className="space-y-3">
          {/* Header row with legend */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
              Live pipelines · {(opportunities as unknown[]).length}
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              {LEGEND.map((l) => (
                <div key={l.key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${l.colour}`} />
                  <span className="text-[11px] text-stone-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(opportunities as any[]).map((opp) => {
              const counts = countMap.get(opp.id) ?? {
                total: 0, pending: 0, shortlisted: 0, selected: 0,
                byStatus: {}, lastAppAt: null, dailyBuckets: [],
              };
              const isCollaboratorOpp = !isAdminUser && collaboratorOppIds.includes(opp.id) && opp.profile_id !== user.id;
              const partnerName = isAdminUser
                ? (opp.profiles as { full_name: string | null; username: string } | null)?.full_name
                  ?? (opp.profiles as { full_name: string | null; username: string } | null)?.username
                  ?? opp.organiser
                : null;
              const daysLeft = opp.deadline
                ? Math.ceil((new Date(opp.deadline + "T00:00:00").getTime() - Date.now()) / 86400000)
                : null;
              const reviewedCount = counts.total - (counts.byStatus.pending ?? 0);
              const reviewedPct = counts.total > 0 ? Math.round((reviewedCount / counts.total) * 100) : 0;
              const location = [opp.city, opp.country].filter(Boolean).join(", ");

              return (
                <Link
                  key={opp.id}
                  href={`/partner/dashboard/${opp.id}`}
                  className="block border border-black/10 bg-white p-5 hover:border-black/30 hover:shadow-sm transition-all group"
                >
                  {/* Tags row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs border border-black/20 px-2 py-0.5">{opp.type}</span>
                    {location && <span className="text-xs text-stone-500">{location}</span>}
                    {isCollaboratorOpp && (
                      <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Collaborator</span>
                    )}
                    {daysLeft !== null && (
                      <span className={`text-xs ${daysLeft < 7 ? "text-red-500 font-medium" : "text-stone-400"}`}>
                        {daysLeft > 0 ? `${daysLeft} days left` : "Closed"}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p className="font-semibold text-base mb-1.5 leading-snug">{opp.title}</p>

                  {/* Metadata row */}
                  <div className="flex items-center gap-0 text-xs text-stone-400 mb-4 flex-wrap">
                    {opp.funding_range && (
                      <>
                        <span className="font-medium text-stone-600">{opp.funding_range}</span>
                        <span className="mx-2.5">·</span>
                      </>
                    )}
                    {(opp.organiser || partnerName) && (
                      <>
                        <span>{partnerName ?? opp.organiser}</span>
                        {counts.lastAppAt && <span className="mx-2.5">·</span>}
                      </>
                    )}
                    {counts.lastAppAt && (
                      <span>Last application {timeAgo(counts.lastAppAt)}</span>
                    )}
                  </div>

                  {/* Bottom: bar + counts | total | sparkline | arrow */}
                  <div className="flex items-end gap-6">
                    {/* Status bar + breakdown */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {counts.total > 0 ? (
                        <>
                          <div className="flex h-2 overflow-hidden gap-px">
                            {STATUS_ORDER.map((s) => {
                              const n = counts.byStatus[s] ?? 0;
                              if (!n) return null;
                              return (
                                <div
                                  key={s}
                                  className={STATUS_COLOURS[s]}
                                  style={{ width: `${(n / counts.total) * 100}%` }}
                                  title={`${STATUS_LABEL[s]}: ${n}`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex gap-3 text-[11px] text-stone-400 flex-wrap">
                            {STATUS_ORDER.map((s) => {
                              const n = counts.byStatus[s] ?? 0;
                              if (!n) return null;
                              return (
                                <span key={s}>
                                  <strong className="text-stone-700 font-semibold">{n}</strong> {STATUS_LABEL[s]}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-stone-300">No applications yet</p>
                      )}
                    </div>

                    {/* Total count */}
                    {counts.total > 0 && (
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold leading-none">{counts.total}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">applications</p>
                        <p className="text-[11px] text-stone-400">{reviewedPct}% reviewed</p>
                      </div>
                    )}

                    {/* Sparkline */}
                    {counts.dailyBuckets.length > 0 && (
                      <div className="shrink-0 hidden md:block">
                        <Sparkline data={counts.dailyBuckets} />
                      </div>
                    )}

                    {/* Arrow */}
                    <span className="shrink-0 text-stone-300 group-hover:text-stone-600 transition-colors text-lg">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom two-column: needs attention + listings ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Needs attention */}
        {(needsAttention.length > 0 || pendingReview.length > 0) && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Needs your attention</p>
            <div className="space-y-2">
              {needsAttention.map((sub: { id: string; title: string; type: string; status: string }) => (
                <div key={sub.id} className="flex items-center justify-between border border-red-200 bg-red-50 p-3 text-sm">
                  <div>
                    <p className="font-medium text-sm">{sub.title}</p>
                    <p className="text-xs text-stone-500">{sub.type}</p>
                  </div>
                  <span className="text-xs text-red-600 font-medium">Rejected</span>
                </div>
              ))}
              {pendingReview.map((sub: { id: string; title: string; type: string; created_at: string }) => (
                <div key={sub.id} className="flex items-center justify-between border border-black/10 p-3 text-sm">
                  <div>
                    <p className="font-medium text-sm">{sub.title}</p>
                    <p className="text-xs text-stone-500">{sub.type} · Submitted {new Date(sub.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className="text-xs text-stone-400 border border-black/20 px-2 py-0.5">Under review</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All listings table */}
        {allListings && (allListings as unknown[]).length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
              {isAdminUser ? "All listings" : "Your listings"}
            </p>
            <div className="border border-black/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10 bg-stone-50">
                    <th className="text-left py-2 px-3 font-medium text-stone-400">Title</th>
                    <th className="text-left py-2 px-3 font-medium text-stone-400 hidden sm:table-cell">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-stone-400">Status</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(allListings as any[]).map((listing) => {
                    const statusColour =
                      listing.status === "published" ? "text-emerald-700"
                      : listing.status === "draft" || listing.status === "draft_unclaimed" ? "text-amber-700"
                      : "text-stone-400";
                    const statusLabel = listing.status === "draft_unclaimed" ? "draft" : listing.status;
                    const isPipeline = listing.routing_type === "pipeline" && listing.status === "published";
                    const isCollaboratorListing = !isAdminUser && collaboratorOppIds.includes(listing.id) && listing.profile_id !== user.id;
                    return (
                      <tr key={listing.id} className="border-b border-black/5 last:border-0">
                        <td className="py-2.5 px-3 font-medium">{listing.title || <span className="text-stone-300 italic">Untitled</span>}</td>
                        <td className="py-2.5 px-3 text-stone-400 hidden sm:table-cell">{listing.type}</td>
                        <td className={`py-2.5 px-3 ${statusColour} font-medium`}>{statusLabel}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {isPipeline && (
                              <Link href={`/partner/dashboard/${listing.id}`} className="text-stone-400 hover:text-foreground transition-colors">→</Link>
                            )}
                            {!isCollaboratorListing && (
                              <Link href={`/partner/opportunities/${listing.id}/manage`} className="text-stone-400 hover:text-foreground transition-colors text-[10px] uppercase tracking-wide">Edit</Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasPipelines && !(allListings && (allListings as unknown[]).length > 0) && (
        <div className="py-20 text-center space-y-4">
          <p className="text-stone-400 text-sm">No listings yet.</p>
          <Link href="/partners" className="inline-block bg-black text-white text-sm px-5 py-2.5 hover:bg-black/80 transition-colors">
            Create your first listing →
          </Link>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-black/10 bg-white p-5 space-y-1">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-stone-400">{label}</p>
    </div>
  );
}
