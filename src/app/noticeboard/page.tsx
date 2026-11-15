import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getNotices } from "@/lib/noticeboard";
import { getRegions } from "@/lib/regions";
import { NOTICE_KINDS, isNoticeKind } from "@/lib/noticeboard-kinds";
import { NoticeCard } from "@/components/noticeboard/NoticeCard";
import { PostNoticeButton } from "@/components/noticeboard/PostNoticeButton";
import { NoticeRegionSelect } from "@/components/noticeboard/NoticeRegionSelect";

export const metadata: Metadata = {
  title: "Noticeboard",
  description: "Asks and offers between artists in Aotearoa: studio space, shared equipment, framers, collaborators.",
  alternates: { canonical: "https://patronage.nz/noticeboard" },
};

interface Props {
  searchParams: Promise<{ kind?: string; region?: string }>;
}

/**
 * The full noticeboard (227). Filter by kind and region; newest first, the
 * viewer's region first. No ranking and nothing boosted.
 */
export default async function NoticeboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const kind = isNoticeKind(params.kind) ? params.kind : null;
  const regionId = params.region && /^[0-9a-f-]{36}$/i.test(params.region) ? params.region : null;

  const { user } = await getServerUser();
  const [profile, regions] = await Promise.all([
    user ? getProfileById(user.id) : Promise.resolve(null),
    getRegions(),
  ]);
  const viewerRegionId = profile?.region_id ?? null;
  const notices = await getNotices({ kind, regionId, regionFirstId: regionId ? null : viewerRegionId });
  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));
  const viewerRegionName = regions.find((r) => r.id === viewerRegionId)?.name ?? null;
  const canPost = !user || !profile?.is_minor;

  const chipHref = (k: string | null) => {
    const q = new URLSearchParams();
    if (k) q.set("kind", k);
    if (regionId) q.set("region", regionId);
    const s = q.toString();
    return s ? `/noticeboard?${s}` : "/noticeboard";
  };
  const chipCls = (active: boolean) =>
    `btn btn-sm ${active ? "btn-outline bg-muted" : "btn-ghost"}`;

  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pb-6 pt-7 sm:px-6 sm:pt-9">
          <Link href="/feed" className="font-mono text-xs text-[color:var(--fg-muted)] hover:text-foreground">← Explore</Link>
          <h1 className="t-display mt-3 text-[32px] sm:text-[40px]">Noticeboard</h1>
          <p className="mt-2 max-w-[560px] text-[14.5px] leading-[1.55] text-[color:var(--fg-muted)]">
            Asks and offers between artists. Each notice runs for 30 days, and replies are public so others can pitch in.
          </p>
        </div>
      </div>

      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:flex-wrap sm:px-0">
              <Link href={chipHref(null)} className={chipCls(!kind)} aria-current={!kind ? "page" : undefined}>All</Link>
              {NOTICE_KINDS.map((k) => (
                <Link key={k.value} href={chipHref(k.value)} className={`${chipCls(kind === k.value)} shrink-0`} aria-current={kind === k.value ? "page" : undefined}>
                  {k.label}
                </Link>
              ))}
            </div>
            <div className="flex w-full items-center gap-2 pt-2 sm:ml-auto sm:w-auto sm:pt-0">
              <span className="hidden font-mono text-[11px] text-[color:var(--fg-muted)] lg:inline">
                Newest first{viewerRegionName && !regionId ? ` · ${viewerRegionName} first` : ""}
              </span>
              <Suspense>
                <NoticeRegionSelect regions={regionOptions} value={regionId} />
              </Suspense>
              {canPost && (
                <PostNoticeButton
                  regions={regionOptions}
                  defaultRegionId={viewerRegionId}
                  isLoggedIn={!!user}
                  className="btn btn-primary btn-sm shrink-0"
                />
              )}
            </div>
          </div>

          {notices.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {notices.map((n) => <NoticeCard key={n.id} notice={n} currentUserId={user?.id} />)}
            </div>
          ) : (
            <div className="bg-card p-8 text-center">
              <p className="text-sm font-medium">
                {kind || regionId ? "No notices match that right now." : "Nothing on the board yet."}
              </p>
              <p className="mt-1 text-[13px] text-[color:var(--fg-muted)]">
                Post an ask or an offer: a desk going, a press to share, a framer wanted. It runs for 30 days.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
