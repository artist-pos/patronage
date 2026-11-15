import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getNoticeById, getNoticeReplies } from "@/lib/noticeboard";
import { NOTICE_KIND_LABEL, daysLeft, shortAgo } from "@/lib/noticeboard-kinds";
import { NoticeThread } from "@/components/noticeboard/NoticeThread";
import { MessagePosterButton } from "@/components/noticeboard/MessagePosterButton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const notice = /^[0-9a-f-]{36}$/i.test(id) ? await getNoticeById(id) : null;
  if (!notice) return { title: "Notice not found" };
  return {
    title: `${NOTICE_KIND_LABEL[notice.kind]}: ${notice.body.slice(0, 60)}`,
    description: notice.body,
    // Notices are short-lived; keep them out of search.
    robots: { index: false, follow: true },
  };
}

export default async function NoticePage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, supabase } = await getServerUser();
  const [notice, replies, profile] = await Promise.all([
    getNoticeById(id),
    getNoticeReplies(id),
    user ? getProfileById(user.id) : Promise.resolve(null),
  ]);
  if (!notice) notFound();

  const { data: mute } = user
    ? await supabase.from("notice_mutes").select("notice_id").eq("notice_id", id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  const isPoster = user?.id === notice.author_id;
  const closed = !!notice.sorted_at || new Date(notice.expires_at) <= new Date() || notice.admin_hidden;
  const posterFirst = notice.author_name.split(" ")[0];
  const runsUntil = new Date(notice.expires_at).toLocaleDateString("en-NZ", { day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-feed-bg">
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/noticeboard" className="font-mono text-xs text-[color:var(--fg-muted)] hover:text-foreground">← Noticeboard</Link>

        <article className="mt-4 bg-card p-5 sm:p-8">
          <span className="tag">{NOTICE_KIND_LABEL[notice.kind]}</span>
          <h1 className="mt-4 text-[20px] font-medium leading-[1.45] tracking-[-0.015em] sm:text-[24px]">{notice.body}</h1>
          <p className="mt-5 text-sm font-medium">
            {isPoster ? (
              "You"
            ) : (
              <Link href={`/${notice.author_username}`} className="hover:underline underline-offset-2">{notice.author_name}</Link>
            )}
            <span className="ml-2 font-mono text-[11px] font-normal text-[color:var(--fg-muted)]">
              {[notice.author_role_label, notice.region_name].filter(Boolean).join(", ")}
            </span>
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-[color:var(--fg-subtle)]">
            Posted {shortAgo(notice.created_at)} ·{" "}
            {notice.sorted_at ? "Sorted" : closed ? "Closed" : `${daysLeft(notice.expires_at)}, until ${runsUntil}`}
          </p>
          {!isPoster && user && !profile?.is_minor && (
            <MessagePosterButton posterId={notice.author_id} label={`Message ${posterFirst} privately`} />
          )}

          <div className="mt-7">
            <NoticeThread
              noticeId={notice.id}
              posterId={notice.author_id}
              posterFirstName={posterFirst}
              initialReplies={replies}
              currentUserId={user?.id}
              currentUserName={profile?.full_name ?? profile?.username ?? undefined}
              currentUserUsername={profile?.username}
              canReply={!!user && !profile?.is_minor}
              initiallyMuted={!!mute}
              closed={closed}
            />
          </div>
        </article>
      </div>
    </div>
  );
}
