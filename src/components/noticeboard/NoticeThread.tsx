"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteNoticeReply,
  markNoticeSorted,
  replyToNotice,
  setNoticeMuted,
  setNoticeReplyHidden,
} from "@/actions/noticeboard";
import { reportContent } from "@/actions/reports";
import { shortAgo } from "@/lib/noticeboard-kinds";
import type { NoticeReply } from "@/types/database";

interface Props {
  noticeId: string;
  posterId: string;
  posterFirstName: string;
  initialReplies: NoticeReply[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  /** Signed in and not under 18. */
  canReply: boolean;
  initiallyMuted: boolean;
  /** Sorted or expired: readable, no new replies. */
  closed: boolean;
}

/**
 * Public replies on a notice (227). The poster hears about every reply, people
 * in the thread hear about later ones, and either can mute it. The poster can
 * hide replies and mark the notice sorted.
 */
export function NoticeThread({
  noticeId,
  posterId,
  posterFirstName,
  initialReplies,
  currentUserId,
  currentUserName,
  currentUserUsername,
  canReply,
  initiallyMuted,
  closed,
}: Props) {
  const router = useRouter();
  const [replies, setReplies] = useState(initialReplies);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [muted, setMuted] = useState(initiallyMuted);
  const [confirmSorted, setConfirmSorted] = useState(false);
  const [pending, startTransition] = useTransition();
  const isPoster = !!currentUserId && currentUserId === posterId;
  const tempCount = useRef(0);

  function flash(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) { setError("Write a reply first."); return; }
    const tempId = `temp-${++tempCount.current}`;
    const now = new Date().toISOString();
    setReplies((r) => [...r, {
      id: tempId, notice_id: noticeId, author_id: currentUserId ?? "", body, hidden: false,
      created_at: now, author_name: currentUserName ?? "You", author_username: currentUserUsername ?? "",
    }]);
    setText("");
    startTransition(async () => {
      const res = await replyToNotice(noticeId, body);
      if (res.error) {
        setReplies((r) => r.filter((x) => x.id !== tempId));
        setText(body);
        setError(res.error);
        return;
      }
      setReplies((r) => r.map((x) => (x.id === tempId ? { ...x, id: res.id!, created_at: res.created_at! } : x)));
      flash(isPoster ? "Replied. Everyone in the thread is notified." : `Replied. ${posterFirstName} is notified.`);
    });
  }

  function toggleHidden(reply: NoticeReply) {
    const hide = !reply.hidden;
    setReplies((r) => r.map((x) => (x.id === reply.id ? { ...x, hidden: hide } : x)));
    startTransition(async () => {
      const res = await setNoticeReplyHidden(reply.id, noticeId, hide);
      if (res.error) { setReplies((r) => r.map((x) => (x.id === reply.id ? { ...x, hidden: !hide } : x))); flash(res.error); }
      else flash(hide ? "Hidden. Only you and its author can see it." : "Shown again.");
    });
  }

  function remove(reply: NoticeReply) {
    const prev = replies;
    setReplies((r) => r.filter((x) => x.id !== reply.id));
    startTransition(async () => {
      const res = await deleteNoticeReply(reply.id, noticeId);
      if (res.error) { setReplies(prev); flash(res.error); }
    });
  }

  function report(itemType: "notice" | "notice_reply", id: string) {
    startTransition(async () => {
      const res = await reportContent(itemType, id);
      flash(res.error ?? "Reported. An admin will look at it.");
    });
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    startTransition(async () => {
      const res = await setNoticeMuted(noticeId, next);
      if (res.error) { setMuted(!next); flash(res.error); }
      else flash(next ? "Muted. You won't hear about new replies." : "Unmuted.");
    });
  }

  function sorted() {
    startTransition(async () => {
      const res = await markNoticeSorted(noticeId);
      if (res.error) { flash(res.error); return; }
      router.push("/noticeboard");
    });
  }

  return (
    <div>
      {isPoster && !closed && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {confirmSorted ? (
            <>
              <span className="text-[13px]">Take it off the board? The thread goes with it.</span>
              <button type="button" onClick={sorted} disabled={pending} className="btn btn-primary btn-sm">Mark as sorted</button>
              <button type="button" onClick={() => setConfirmSorted(false)} className="btn btn-ghost btn-sm">Keep it up</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmSorted(true)} className="btn btn-primary">Mark as sorted</button>
          )}
        </div>
      )}

      <section className="border-t border-border pt-5">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h2 className="t-section-label">Replies</h2>
          {currentUserId && (replies.length > 0 || isPoster) && (
            <button type="button" onClick={toggleMute} className="font-mono text-[11px] text-[color:var(--fg-muted)] hover:text-foreground">
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
        </div>

        {replies.length > 0 ? (
          <div className="divide-y divide-border">
            {replies.map((r) => {
              const own = r.author_id === currentUserId;
              return (
                <div key={r.id} className="py-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/${r.author_username}`} className="text-[13px] font-medium hover:underline underline-offset-2">
                      {own ? "You" : r.author_name}
                    </Link>
                    {r.author_id === posterId && <span className="tag">poster</span>}
                    <span className="ml-auto font-mono text-[11px] text-[color:var(--fg-subtle)]">{shortAgo(r.created_at)}</span>
                  </div>
                  <p className={`mt-1 text-sm leading-[1.55] ${r.hidden ? "italic text-[color:var(--fg-subtle)]" : ""}`}>{r.body}</p>
                  {r.hidden && <p className="mt-1 font-mono text-[11px] text-[color:var(--fg-muted)]">Hidden by the poster. Only they and you can see it.</p>}
                  {!r.id.startsWith("temp-") && (
                    <div className="mt-1.5 flex gap-4 font-mono text-[11px] text-[color:var(--fg-subtle)]">
                      {isPoster && !own && (
                        <button type="button" onClick={() => toggleHidden(r)} className="hover:text-foreground">{r.hidden ? "Show" : "Hide"}</button>
                      )}
                      {own && <button type="button" onClick={() => remove(r)} className="hover:text-foreground">Delete</button>}
                      {currentUserId && !own && !isPoster && (
                        <button type="button" onClick={() => report("notice_reply", r.id)} className="hover:text-[color:var(--urgent)]">Report</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-3 text-[13px] text-[color:var(--fg-muted)]">No replies yet.</p>
        )}

        {closed ? (
          <p className="mt-3 bg-muted px-3 py-2.5 text-[13px] text-[color:var(--fg-muted)]">This notice has closed, so it can&rsquo;t take new replies.</p>
        ) : canReply ? (
          <form onSubmit={submit} className="mt-3 space-y-2" noValidate>
            <label htmlFor="notice-reply" className="sr-only">Reply</label>
            <textarea
              id="notice-reply"
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 500)); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }}
              placeholder={isPoster ? "Reply to the thread…" : `Reply to ${posterFirstName}…`}
              rows={2}
              className="w-full resize-none border border-border bg-card px-3 py-2.5 text-sm leading-[1.55] outline-none transition-colors focus:border-foreground"
            />
            {error && <p role="alert" className="text-[13px] text-[color:var(--urgent)]">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                {isPoster ? "Everyone in the thread is notified." : `${posterFirstName} and others in the thread are notified. Use @name to tag someone.`}
              </span>
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm shrink-0">Reply</button>
            </div>
          </form>
        ) : !currentUserId ? (
          <p className="mt-3 font-mono text-xs text-[color:var(--fg-muted)]">
            <Link href={`/auth/login?next=/noticeboard/${noticeId}`} className="underline underline-offset-2 hover:text-foreground">Sign in</Link> to reply.
          </p>
        ) : null}

        {currentUserId && !isPoster && (
          <button type="button" onClick={() => report("notice", noticeId)} className="mt-6 block font-mono text-[11px] text-[color:var(--fg-subtle)] hover:text-[color:var(--urgent)]">
            Report this notice
          </button>
        )}
        {status && <p role="status" className="mt-3 font-mono text-[11px] text-[color:var(--fg-muted)]">{status}</p>}
      </section>
    </div>
  );
}
