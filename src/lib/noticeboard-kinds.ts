import type { NoticeKind } from "@/types/database";

/** Noticeboard kinds (227), in the order they're offered. Client-safe. */
export const NOTICE_KINDS: { value: NoticeKind; label: string }[] = [
  { value: "wanted", label: "Wanted" },
  { value: "offering", label: "Offering" },
  { value: "studio_space", label: "Studio space" },
  { value: "services", label: "Services" },
  { value: "collaborate", label: "Collaborate" },
];

export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = Object.fromEntries(
  NOTICE_KINDS.map((k) => [k.value, k.label]),
) as Record<NoticeKind, string>;

export const NOTICE_MAX = 160;

export function isNoticeKind(v: string | null | undefined): v is NoticeKind {
  return !!v && NOTICE_KINDS.some((k) => k.value === v);
}

/** "26 days left", "1 day left", "Last day". */
export function daysLeft(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 1) return "Last day";
  return `${days} days left`;
}

/** "2h ago", "3d ago", "2w ago". */
export function shortAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}
