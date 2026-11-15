"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  addNote,
  deleteNote,
  getNoteThreadMuted,
  setNoteHidden,
  setNotesOff,
  setNoteThreadMuted,
} from "@/actions/notes";
import { reportContent } from "@/actions/reports";
import type { NoteWithSender } from "@/types/database";

const MAX = 280;

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

interface Props {
  initialNotes: NoteWithSender[];
  updateId: string;
  artistId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  currentUserAvatarUrl?: string | null;
  /** The artist turned notes off for this update (227). */
  notesOff?: boolean;
  /** Open on first render, e.g. on the update's own page. Threads start closed. */
  defaultOpen?: boolean;
}

/**
 * Public notes on a studio update, with one level of replies (227). The artist
 * is notified of every note, people hear when someone replies to them or names
 * them with @username, and anyone can mute the thread. The artist can hide a
 * note or turn notes off. No counts anywhere: closed, it shows the newest note.
 */
export function NotesSection({
  initialNotes,
  updateId,
  artistId,
  currentUserId,
  currentUserName,
  currentUserUsername,
  currentUserAvatarUrl,
  notesOff: initialNotesOff = false,
  defaultOpen = false,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [open, setOpen] = useState(defaultOpen);
  const [notesOff, setNotesOffState] = useState(initialNotesOff);
  const [muted, setMuted] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tempCount = useRef(0);

  const isArtist = !!currentUserId && currentUserId === artistId;
  const canPost = !!currentUserId && !!currentUserName && !notesOff;

  // Mute state is private, so it is fetched only once the thread is open.
  useEffect(() => {
    if (!open || !currentUserId) return;
    getNoteThreadMuted(updateId).then(setMuted).catch(() => {});
  }, [open, currentUserId, updateId]);

  function flash(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  }

  const topLevel = notes.filter((n) => !n.parent_id);
  const repliesTo = (id: string) => notes.filter((n) => n.parent_id === id);
  const latest = [...notes].reverse().find((n) => n.is_visible);

  async function post(content: string, parentId: string | null): Promise<boolean> {
    if (!currentUserId || !currentUserName) return false;
    const tempId = `temp-${++tempCount.current}`;
    const optimistic: NoteWithSender = {
      id: tempId,
      update_id: updateId,
      artist_id: artistId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_username: currentUserUsername ?? "",
      sender_avatar_url: currentUserAvatarUrl ?? null,
      content,
      is_visible: true,
      parent_id: parentId,
      created_at: new Date().toISOString(),
    };
    setNotes((n) => [...n, optimistic]);
    try {
      const saved = await addNote(updateId, artistId, content, parentId);
      setNotes((n) => n.map((x) => (x.id === tempId ? { ...x, id: saved.id, created_at: saved.created_at, parent_id: saved.parent_id } : x)));
      return true;
    } catch (err) {
      setNotes((n) => n.filter((x) => x.id !== tempId));
      flash(err instanceof Error ? err.message : "We couldn't post that note. Try again.");
      return false;
    }
  }

  function remove(note: NoteWithSender) {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== note.id && x.parent_id !== note.id));
    deleteNote(note.id, updateId).catch(() => setNotes(prev));
  }

  function toggleHidden(note: NoteWithSender) {
    const hide = note.is_visible;
    setNotes((n) => n.map((x) => (x.id === note.id ? { ...x, is_visible: !hide } : x)));
    startTransition(async () => {
      const res = await setNoteHidden(note.id, updateId, hide);
      if (res.error) {
        setNotes((n) => n.map((x) => (x.id === note.id ? { ...x, is_visible: hide } : x)));
        flash(res.error);
      } else {
        flash(hide ? "Hidden. Only you can see it now." : "Shown again.");
      }
    });
  }

  function report(note: NoteWithSender) {
    startTransition(async () => {
      const res = await reportContent("note", note.id);
      flash(res.error ?? "Reported. An admin will look at it.");
    });
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    startTransition(async () => {
      const res = await setNoteThreadMuted(updateId, next);
      if (res.error) { setMuted(!next); flash(res.error); }
      else flash(next ? "Muted. You won't hear about new notes here." : "Unmuted.");
    });
  }

  function toggleNotesOff() {
    const next = !notesOff;
    setNotesOffState(next);
    startTransition(async () => {
      const res = await setNotesOff(updateId, next);
      if (res.error) { setNotesOffState(!next); flash(res.error); }
      else flash(next ? "Notes are off for this update." : "Notes are back on.");
    });
  }

  if (notes.length === 0 && !canPost && !isArtist) {
    if (notesOff || currentUserId) return null;
    return (
      <p className="font-mono text-xs text-[color:var(--fg-muted)]">
        <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">Sign in</Link> to leave a note.
      </p>
    );
  }

  // Closed: the newest note as a line, never a count.
  if (!open) {
    return (
      <div id="notes" className="flex items-start justify-between gap-4">
        {latest && !notesOff ? (
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left text-[13px] leading-[1.5] text-[color:var(--fg-muted)] hover:text-foreground">
            <span className="line-clamp-2">
              <span className="font-medium text-foreground">{latest.sender_name}</span> {latest.content}
            </span>
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm shrink-0">
          {latest && !notesOff ? "Open notes" : canPost ? "Add a note" : "Notes"}
        </button>
      </div>
    );
  }

  const noteRow = (note: NoteWithSender, isReply: boolean) => {
    const own = note.sender_id === currentUserId;
    const byArtist = note.sender_id === artistId;
    return (
      <div key={note.id} className={`flex items-start gap-2.5 ${isReply ? "" : "py-3"}`}>
        <Link href={`/${note.sender_username}`} className="mt-0.5 shrink-0" aria-hidden tabIndex={-1}>
          {note.sender_avatar_url ? (
            <span className="relative block h-6 w-6 overflow-hidden bg-muted">
              <Image src={note.sender_avatar_url} alt="" fill className="object-cover" sizes="24px" />
            </span>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center bg-muted font-mono text-[10px] font-semibold">
              {note.sender_name.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/${note.sender_username}`} className="text-[13px] font-medium hover:underline underline-offset-2">
              {note.sender_name}
            </Link>
            {byArtist && <span className="tag">artist</span>}
            <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">{timeAgo(note.created_at)}</span>
          </div>
          <p className={`mt-0.5 text-sm leading-[1.55] ${note.is_visible ? "" : "italic text-[color:var(--fg-subtle)]"}`}>
            {note.content}
          </p>
          {!note.is_visible && (
            <p className="mt-1 font-mono text-[11px] text-[color:var(--fg-muted)]">Hidden. Only you can see it.</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[11px] text-[color:var(--fg-subtle)]">
            {canPost && note.is_visible && !note.id.startsWith("temp-") && (
              <button type="button" onClick={() => setReplyTo(isReply ? note.parent_id ?? note.id : note.id)} className="hover:text-foreground">
                Reply
              </button>
            )}
            {isArtist && !own && (
              <button type="button" onClick={() => toggleHidden(note)} className="hover:text-foreground">
                {note.is_visible ? "Hide" : "Show"}
              </button>
            )}
            {(own || isArtist) && !note.id.startsWith("temp-") && (
              <button type="button" onClick={() => remove(note)} className="hover:text-foreground">Delete</button>
            )}
            {currentUserId && !own && !isArtist && (
              <button type="button" onClick={() => report(note)} className="hover:text-[color:var(--urgent)]">Report</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section id="notes" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="t-section-label">Notes</p>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[color:var(--fg-muted)]">
          {currentUserId && !notesOff && (
            <button type="button" onClick={toggleMute} className="hover:text-foreground">
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
          {isArtist && (
            <button type="button" onClick={toggleNotesOff} className="hover:text-foreground">
              {notesOff ? "Turn notes on" : "Turn notes off"}
            </button>
          )}
          {!defaultOpen && (
            <button type="button" onClick={() => setOpen(false)} className="hover:text-foreground">Close</button>
          )}
        </div>
      </div>

      {notesOff ? (
        <p className="bg-muted px-3 py-2.5 text-[13px] text-[color:var(--fg-muted)]">
          {isArtist
            ? "You turned notes off for this update. Existing notes are kept but nobody can add more."
            : "The artist has turned notes off for this update."}
        </p>
      ) : null}

      {topLevel.length > 0 ? (
        <div className="divide-y divide-border">
          {topLevel.map((note) => (
            <div key={note.id}>
              {noteRow(note, false)}
              {(repliesTo(note.id).length > 0 || replyTo === note.id) && (
                <div className="mb-3 ml-8 space-y-3 border-l border-border pl-4">
                  {repliesTo(note.id).map((r) => noteRow(r, true))}
                  {replyTo === note.id && canPost && (
                    <NoteForm
                      placeholder={`Reply to ${note.sender_name}…`}
                      submitLabel="Reply"
                      autoFocus
                      onCancel={() => setReplyTo(null)}
                      onSubmit={async (text) => {
                        const ok = await post(text, note.id);
                        if (ok) setReplyTo(null);
                        return ok;
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !notesOff && <p className="text-[13px] text-[color:var(--fg-muted)]">No notes yet.</p>
      )}

      {canPost && (
        <NoteForm
          placeholder={isArtist ? "Add a note to your update…" : "Add a note…"}
          hint={isArtist ? "People you reply to are notified." : "The artist is notified. Use @name to tag someone."}
          submitLabel="Post note"
          onSubmit={(text) => post(text, null)}
        />
      )}

      {status && (
        <p role="status" className="font-mono text-[11px] text-[color:var(--fg-muted)]">{status}</p>
      )}
    </section>
  );
}

function NoteForm({
  placeholder,
  hint,
  submitLabel,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  hint?: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) { setError("Write something first."); return; }
    setPosting(true);
    const ok = await onSubmit(trimmed);
    setPosting(false);
    if (ok) setText("");
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value.slice(0, MAX)); if (error) setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        autoFocus={autoFocus}
        className="w-full resize-none border border-border bg-card px-3 py-2 text-sm leading-[1.55] outline-none transition-colors focus:border-foreground"
        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
      />
      {error && <p role="alert" className="text-[13px] text-[color:var(--urgent)]">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
          {hint ?? `${text.length}/${MAX}`}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
          )}
          <button type="submit" disabled={posting} className="btn btn-primary btn-sm">
            {posting ? "Posting…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
