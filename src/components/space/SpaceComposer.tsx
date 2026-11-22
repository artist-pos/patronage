"use client";

import { useState } from "react";
import { postSpaceNote } from "@/app/partners/here-together/space/actions";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";
import { RollingHeadline } from "@/components/home/RollingHeadline";
import type { SpaceNote } from "@/lib/space-board";

const NOTE_MAX = 280;
const NAME_MAX = 60;

// Short enough to sit on one line after "I want a space" on a phone.
const PROMPTS = [
  "to make work in.",
  "to show my work.",
  "for crits and talks.",
  "for workshops.",
  "to bring my kids.",
  "to sell prints.",
  "to meet people.",
  "to just be in.",
];

interface Props {
  defaultName: string;
  onPinned: (note: SpaceNote) => void;
}

/** A blank sticky note to write on. Posting needs no account. */
export function SpaceComposer({ defaultName, onPinned }: Props) {
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const loadedAt = useFormLoadedAt();

  const left = NOTE_MAX - body.length;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setDone(false);
    const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
    const res = await postSpaceNote({ body, name, loadedAt, [HONEYPOT_FIELD]: honeypot });
    setSending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.note) onPinned(res.note);
    setBody("");
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-md -rotate-[0.6deg] bg-[#FFF3B5] px-5 pb-5 pt-5 shadow-[0_1px_2px_rgba(28,25,23,0.1),0_10px_24px_-12px_rgba(28,25,23,0.35)]"
    >
      <label htmlFor="space-body" className="sr-only">Your note: what do you want out of a creative space?</label>
      <div className="relative">
        {/* A rolling placeholder (same motion as the landing page headline), from
            what Here Together is planned to be. Gone as soon as there's text. */}
        {!body && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 text-[17px] leading-[1.45] text-[#a39a7a]">
            <RollingHeadline prefix="I want a space" phrases={PROMPTS} />
          </div>
        )}
        <textarea
          id="space-body"
          required
          rows={4}
          maxLength={NOTE_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="relative block w-full resize-none bg-transparent text-[17px] leading-[1.45] outline-none"
        />
      </div>
      <div className="mt-1 text-right text-[11px] tabular-nums text-[#a8a29e]" aria-live="polite">
        {left <= 60 ? `${left} left` : " "}
      </div>
      <div className="mt-2 flex items-end gap-3 border-t border-black/10 pt-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="space-name" className="block text-[12px] text-[#78716c]">Your name</label>
          <input
            id="space-name"
            type="text"
            required
            maxLength={NAME_MAX}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-full border-b border-black/20 bg-transparent py-1 text-[15px] outline-none focus:border-[#1c1917]"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !body.trim() || !name.trim()}
          className="h-10 shrink-0 bg-[#1c1917] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {sending ? "Posting…" : "Post"}
        </button>
      </div>
      <HoneypotField />
      {error && <p className="mt-3 text-[13px] text-[#ED2100]" role="alert">{error}</p>}
      {done && <p className="mt-3 text-[13px] text-[#57534e]" role="status">Posted. Thank you.</p>}
    </form>
  );
}
