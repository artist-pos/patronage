"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  inviteArtistToRoster,
  removeFromRoster,
  searchArtists,
  updateRosterYears,
} from "./actions";

export interface RosterEntry {
  membershipId: string;
  artistId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  city: string | null;
  /** False while the artist has not yet confirmed. Nothing public renders. */
  accepted: boolean;
  startYear: number | null;
  endYear: number | null;
}

interface Props {
  entries: RosterEntry[];
  /** Alumni lists are dated and read as a timeline; rosters are a current list. */
  isAlumni: boolean;
  /** "represented artist" or "participant", for the copy. */
  rosterNoun: string;
}

interface Candidate {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
}

export function RosterManager({ entries, isAlumni, rosterNoun }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function runSearch(value: string) {
    setQuery(value);
    setPicked(null);
    if (value.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setCandidates(await searchArtists(value));
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function submit() {
    if (!picked) return;
    setError(null);
    start(async () => {
      const result = await inviteArtistToRoster({
        artistId: picked.id,
        startYear: startYear ? Number(startYear) : null,
        endYear: endYear ? Number(endYear) : null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      flash(`Invitation sent to ${picked.full_name ?? picked.username}.`);
      setPicked(null);
      setQuery("");
      setCandidates([]);
      setStartYear("");
      setEndYear("");
    });
  }

  const accepted = entries.filter((e) => e.accepted);
  const waiting = entries.filter((e) => !e.accepted);

  return (
    <section className="space-y-6">
      {/* ── Add ── */}
      <div className="space-y-3 bg-[color:var(--brand-sub)] p-5">
        <label
          htmlFor="roster-search"
          className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]"
        >
          Add an artist
        </label>

        <input
          id="roster-search"
          type="text"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search by name or username"
          className="w-full max-w-md border border-border bg-card px-3 py-2.5 text-[15px] outline-none focus:border-foreground"
        />

        {candidates.length > 0 && !picked && (
          <ul className="max-w-md divide-y divide-border border border-border bg-card">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(c);
                    setQuery(c.full_name ?? c.username);
                    setCandidates([]);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--tint)]"
                >
                  <span className="text-[14px]">{c.full_name ?? c.username}</span>
                  <span className="ml-auto font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {c.city ?? `@${c.username}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picked && (
          <div className="space-y-3">
            <p className="text-[14px]">
              Invite <strong>{picked.full_name ?? picked.username}</strong> as a{" "}
              {rosterNoun}.
            </p>

            {isAlumni && (
              <div className="flex flex-wrap items-end gap-3">
                <YearField
                  id="start-year"
                  label="From"
                  value={startYear}
                  onChange={setStartYear}
                />
                <YearField
                  id="end-year"
                  label="To"
                  value={endYear}
                  onChange={setEndYear}
                  hint="Leave empty if they are still there"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="bg-brand px-[22px] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send invitation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setQuery("");
                }}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-[color:var(--fg-muted)]">
          They confirm before appearing anywhere public.
        </p>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {toast && (
          <p aria-live="polite" className="text-xs text-[color:var(--fg-muted)]">
            {toast}
          </p>
        )}
      </div>

      {/* ── The list ── */}
      {accepted.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            {isAlumni ? "Been through" : "On your page"}
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {accepted.map((e) => (
              <Row key={e.membershipId} entry={e} isAlumni={isAlumni} onFlash={flash} />
            ))}
          </ul>
        </div>
      )}

      {waiting.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Waiting for them to confirm
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {waiting.map((e) => (
              <Row key={e.membershipId} entry={e} isAlumni={isAlumni} onFlash={flash} />
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nobody on your list yet. Search above, or invite artists in bulk below.
        </p>
      )}
    </section>
  );
}

function YearField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-[color:var(--fg-muted)]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1900}
        max={new Date().getFullYear() + 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="2024"
        className="w-24 border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-foreground"
      />
      {hint && <p className="text-[11px] text-[color:var(--fg-subtle)]">{hint}</p>}
    </div>
  );
}

function Row({
  entry,
  isAlumni,
  onFlash,
}: {
  entry: RosterEntry;
  isAlumni: boolean;
  onFlash: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [startYear, setStartYear] = useState(entry.startYear?.toString() ?? "");
  const [endYear, setEndYear] = useState(entry.endYear?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const years = formatYears(entry.startYear, entry.endYear);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Link
        href={`/${entry.username}`}
        className="text-[14.5px] transition-colors hover:text-[color:var(--brand)]"
      >
        {entry.fullName ?? entry.username}
      </Link>

      {isAlumni && !editing && (
        <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
          {years ?? "no years set"}
        </span>
      )}

      {isAlumni && editing && (
        <span className="flex items-center gap-2">
          <input
            type="number"
            aria-label="From year"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            className="w-20 border border-border bg-card px-2 py-1 text-[13px] outline-none focus:border-foreground"
          />
          <span className="text-xs text-[color:var(--fg-subtle)]">to</span>
          <input
            type="number"
            aria-label="To year"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            className="w-20 border border-border bg-card px-2 py-1 text-[13px] outline-none focus:border-foreground"
          />
        </span>
      )}

      <span className="ml-auto flex items-center gap-3">
        {isAlumni && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!editing) {
                setEditing(true);
                return;
              }
              setError(null);
              start(async () => {
                const result = await updateRosterYears(
                  entry.membershipId,
                  startYear ? Number(startYear) : null,
                  endYear ? Number(endYear) : null
                );
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setEditing(false);
                onFlash("Years updated.");
              });
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {editing ? (pending ? "Saving…" : "Save") : "Edit years"}
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await removeFromRoster(entry.membershipId);
              if (result.error) {
                setError(result.error);
                return;
              }
              onFlash("Removed.");
            });
          }}
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-destructive"
        >
          Remove
        </button>
      </span>

      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </li>
  );
}

function formatYears(start: number | null, end: number | null): string | null {
  if (start === null && end === null) return null;
  if (start !== null && end === null) return `${start} to now`;
  if (start === null) return `until ${end}`;
  return start === end ? `${start}` : `${start} to ${end}`;
}
