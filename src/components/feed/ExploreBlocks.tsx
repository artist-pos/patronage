import Link from "next/link";
import { eventDateParts, formatEventTime } from "@/lib/events";
import type { ExploreEvent } from "@/lib/feed";

/**
 * Shared frame for the sidebar's separate cards: each one does one job, like
 * the modules in X's right rail. In the feed (below lg) the same cards sit as
 * tiles, so the frame is the same in both places.
 */
export function SideCard({
  title,
  meta,
  children,
  footer,
}: {
  title: string;
  meta?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="t-section-label">{title}</h2>
        {meta && <span className="truncate font-mono text-[11px] text-[color:var(--fg-muted)]">{meta}</span>}
      </div>
      <div className="px-4 pb-4 pt-3">{children}</div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </section>
  );
}

/**
 * One event as a small opportunity-style card: picture on top with the date on
 * it, then the name, when and where, and who's putting it on. With no picture
 * the same space shows the date large, so every card is the same height.
 */
function EventMini({ e }: { e: ExploreEvent }) {
  const p = eventDateParts(e.date);
  const time = formatEventTime(e.time);
  const img = e.image;
  const where = e.venue?.split(",")[0];
  return (
    <Link
      href={e.href}
      scroll={false}
      className="group block overflow-hidden border border-border bg-card transition-colors hover:border-foreground/40"
    >
      <div className="relative aspect-[16/9] bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center font-mono text-[color:var(--fg-subtle)]">
            <span className="text-[26px] font-semibold leading-none">{p.day}</span>
            <span className="mt-1 text-[11px] tracking-[0.08em]">{p.month}</span>
          </span>
        )}
        {img && (
          <span className="absolute left-2 top-2 w-[38px] border border-foreground bg-card text-center font-mono">
            <span className="block bg-black py-px text-[9px] font-semibold tracking-[0.04em] text-white">{p.month}</span>
            <span className="block py-0.5 text-[15px] font-semibold leading-none">{p.day}</span>
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        {e.label && <p className="t-section-label text-brand">{e.label}</p>}
        <p className="line-clamp-2 text-[13px] font-medium leading-[1.3]">{e.title}</p>
        <p className="truncate font-mono text-[11px] text-[color:var(--fg-muted)]">
          {[p.weekday, time].filter(Boolean).join(" · ")}
        </p>
        {where && <p className="truncate text-[12px] text-[color:var(--fg-muted)]">{where}</p>}
        {e.host && (
          <p className="truncate border-t border-border pt-2 font-mono text-[11px] text-[color:var(--fg-subtle)]">
            {e.host}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * Events: what's on soon, near the viewer first. Always shown, even when
 * nothing is listed yet, so artists can see where an event would go and add one.
 * `addEvent` is the post button, only passed for signed-in adults.
 */
export function EventsBlock({
  events,
  regionName,
  addEvent,
  addFirstEvent,
}: {
  events: ExploreEvent[];
  regionName: string | null;
  /** Small link in the footer when there are events. */
  addEvent?: React.ReactNode;
  /** Button shown in place of the footer when there are none. */
  addFirstEvent?: React.ReactNode;
}) {
  return (
    <SideCard title="Events" meta={regionName ? `${regionName} first` : null} footer={events.length > 0 ? addEvent : undefined}>
      {events.length > 0 ? (
        <div className="space-y-3">
          {events.slice(0, 3).map((e) => (
            <EventMini key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-[color:var(--fg-muted)]">No events yet.</p>
          {addFirstEvent}
        </div>
      )}
    </SideCard>
  );
}

/** Open calls closing in the next seven days. A link, not a list; null when none. */
export function ClosingBlock({ closingCount }: { closingCount: number }) {
  if (closingCount <= 0) return null;
  return (
    <SideCard title="Closing soon">
      <Link href="/opportunities?closing=week" className="block text-[13px] font-medium text-brand underline-offset-2 hover:underline">
        {closingCount} open {closingCount === 1 ? "call closes" : "calls close"} this week
      </Link>
    </SideCard>
  );
}
