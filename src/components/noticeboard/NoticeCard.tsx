import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { NOTICE_KIND_LABEL, daysLeft, shortAgo } from "@/lib/noticeboard-kinds";
import type { NoticeWithAuthor } from "@/types/database";

interface Props {
  notice: NoticeWithAuthor;
  /** Sidebar and feed-tile size: three-line body, one meta row. */
  compact?: boolean;
  currentUserId?: string;
}

/**
 * One notice. Activity shows as when the last reply came, never how many
 * replies there are (227), so a quiet notice doesn't look neglected.
 */
export function NoticeCard({ notice, compact = false, currentUserId }: Props) {
  const mine = !!currentUserId && notice.author_id === currentUserId;
  return (
    <Link
      href={`/noticeboard/${notice.id}`}
      className={`flex flex-col bg-card transition-colors hover:bg-muted ${compact ? "p-3" : "h-full p-[18px]"}`}
    >
      <span className="tag self-start">{NOTICE_KIND_LABEL[notice.kind]}</span>
      <p className={`${compact ? "my-2 line-clamp-3 text-[13px] leading-[1.5]" : "mb-4 mt-3 text-[15px] leading-[1.55]"}`}>
        {notice.body}
      </p>
      {!compact && (
        <p className="mt-auto text-[13px] font-medium">
          {mine ? "You" : notice.author_name}
          <span className="ml-1.5 font-mono text-[11px] font-normal text-[color:var(--fg-muted)]">
            {[notice.author_role_label, notice.region_name].filter(Boolean).join(", ")}
          </span>
        </p>
      )}
      <div className={`flex justify-between gap-2 font-mono text-[11px] text-[color:var(--fg-subtle)] ${compact ? "" : "mt-2 border-t border-border pt-2.5"}`}>
        <span className={compact ? "min-w-0 truncate text-[color:var(--fg-muted)]" : ""}>
          {compact ? (mine ? "You" : notice.author_name) : shortAgo(notice.created_at)}
        </span>
        <span className="shrink-0">{daysLeft(notice.expires_at)}</span>
      </div>
      {notice.last_reply_at && (
        <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-[color:var(--fg-muted)]">
          <MessageSquare className="h-3 w-3" aria-hidden />
          Last reply {shortAgo(notice.last_reply_at)}
        </span>
      )}
    </Link>
  );
}
