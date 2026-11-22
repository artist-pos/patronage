"use client";

import { useState } from "react";
import { setSpaceAppreciation, setSpaceNoteHidden } from "@/app/partners/here-together/space/actions";
import type { SpaceNote } from "@/lib/space-board";
import { SpaceComposer } from "./SpaceComposer";
import { SpaceNoteCard } from "./SpaceNoteCard";

interface Props {
  initialNotes: SpaceNote[];
  initialAppreciated: string[];
  defaultName: string;
  isAdmin: boolean;
}

/**
 * The /space pinboard: a composer, then every note, newest first. Never sorted
 * by appreciations. Counts are public on this board only (migration 228).
 */
export function SpaceBoard({ initialNotes, initialAppreciated, defaultName, isAdmin }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [mine, setMine] = useState(() => new Set(initialAppreciated));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [freshId, setFreshId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function patch(id: string, fn: (n: SpaceNote) => SpaceNote) {
    setNotes((all) => all.map((n) => (n.id === id ? fn(n) : n)));
  }

  function pinned(note: SpaceNote) {
    setNotes((all) => [note, ...all]);
    setFreshId(note.id);
    setTimeout(() => setFreshId((cur) => (cur === note.id ? null : cur)), 4000);
  }

  async function appreciate(id: string) {
    if (pending.has(id)) return;
    const next = !mine.has(id);
    // Optimistic: flip the mark and the count now, reconcile with the server's count.
    setMine((s) => {
      const c = new Set(s);
      if (next) c.add(id);
      else c.delete(id);
      return c;
    });
    patch(id, (n) => ({ ...n, appreciation_count: Math.max(0, n.appreciation_count + (next ? 1 : -1)) }));
    setPending((s) => new Set(s).add(id));
    const res = await setSpaceAppreciation(id, next);
    setPending((s) => {
      const c = new Set(s);
      c.delete(id);
      return c;
    });
    if (res.error) {
      setMine((s) => {
        const c = new Set(s);
        if (next) c.delete(id);
        else c.add(id);
        return c;
      });
      patch(id, (n) => ({ ...n, appreciation_count: Math.max(0, n.appreciation_count + (next ? -1 : 1)) }));
      flash(res.error);
      return;
    }
    if (typeof res.count === "number") patch(id, (n) => ({ ...n, appreciation_count: res.count! }));
  }

  async function toggleHidden(note: SpaceNote) {
    const hidden = !note.hidden;
    patch(note.id, (n) => ({ ...n, hidden }));
    const res = await setSpaceNoteHidden(note.id, hidden);
    if (res.error) {
      patch(note.id, (n) => ({ ...n, hidden: !hidden }));
      flash(res.error);
    }
  }

  const card = (n: SpaceNote) => (
    <SpaceNoteCard
      key={n.id}
      note={n}
      appreciated={mine.has(n.id)}
      pending={pending.has(n.id)}
      onAppreciate={() => appreciate(n.id)}
      isAdmin={isAdmin}
      onToggleHidden={() => toggleHidden(n)}
      fresh={freshId === n.id}
    />
  );

  return (
    <>
      <section
        aria-label="Notes"
        className="mt-8 pb-10 sm:mt-10"
      >
        <div className="mb-8 sm:mb-10">
          <SpaceComposer defaultName={defaultName} onPinned={pinned} />
        </div>

        {notes.length > 0 && (
          <div>
            {/* Phones: a manual two-column split. CSS columns misbehave on iOS
                Safari inside flex parents (see CLAUDE.md, fragile area 1). */}
            <div className="flex gap-3 md:hidden">
              {[0, 1].map((col) => (
                <div key={col} className="flex min-w-0 flex-1 flex-col">
                  {notes.filter((_, i) => i % 2 === col).map(card)}
                </div>
              ))}
            </div>
            <div className="hidden gap-4 md:block md:columns-3 lg:columns-4 2xl:columns-5">{notes.map(card)}</div>
          </div>
        )}
      </section>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm bg-[#1c1917] px-4 py-3 text-center text-[13px] text-white md:bottom-6">
          {toast}
        </div>
      )}
    </>
  );
}
