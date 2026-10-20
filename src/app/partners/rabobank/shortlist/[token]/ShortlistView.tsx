"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Gallery } from "../../_components/Gallery";
import {
  getFirstName,
  getRespondentId,
  seededOrder,
  setFirstName,
  subscribe,
} from "@/lib/rabobank/respondent";
import { REACTIONS, safeUrl, type ArtistCard } from "@/lib/rabobank/shortlist";
import type { NameMode } from "@/lib/rabobank/settings";
import { loadMyReactions, saveReaction } from "./actions";

type Mine = Record<string, { reaction: string; comment: string }>;

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function ArtistReaction({
  artist,
  token,
  respondentId,
  firstName,
  nameMode,
  initial,
}: {
  artist: ArtistCard;
  token: string;
  respondentId: string;
  firstName: string;
  nameMode: NameMode;
  initial: { reaction: string; comment: string } | undefined;
}) {
  const [reaction, setReaction] = useState(initial?.reaction ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [status, setStatus] = useState<"" | "saving" | "saved">("");
  const [error, setError] = useState<string | null>(null);
  const blocked = nameMode === "required" && !firstName.trim();

  async function save(nextReaction: string, nextComment: string) {
    setError(null);
    setStatus("saving");
    const res = await saveReaction({
      token,
      artistId: artist.id,
      respondentId,
      firstName,
      reaction: nextReaction,
      comment: nextComment,
    });
    if (res.ok) setStatus("saved");
    else {
      setStatus("");
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What do you think of {artist.name}&rsquo;s work for this space?</legend>
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map((r) => (
            <label
              key={r.key}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${
                reaction === r.key ? "border-foreground bg-foreground text-background" : "border-input"
              } ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`reaction-${artist.id}`}
                checked={reaction === r.key}
                disabled={blocked}
                onChange={() => {
                  setReaction(r.key);
                  void save(r.key, comment);
                }}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`comment-${artist.id}`} className="block text-sm">
          Comment <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id={`comment-${artist.id}`}
          rows={2}
          maxLength={500}
          className={field}
          value={comment}
          disabled={blocked}
          onChange={(e) => {
            setComment(e.target.value);
            setStatus("");
          }}
          onBlur={() => {
            if (reaction && status !== "saved") void save(reaction, comment);
          }}
        />
        {!reaction && comment && (
          <p className="text-xs text-muted-foreground">Choose a response above so your comment is saved.</p>
        )}
      </div>
      <p className="min-h-5 text-sm" role="status" aria-live="polite">
        {status === "saving" && <span className="text-muted-foreground">Saving…</span>}
        {status === "saved" && <span className="text-success">Saved. You can change this any time.</span>}
        {blocked && <span className="text-muted-foreground">Add your first name at the top to respond.</span>}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ShortlistView({
  artists,
  token,
  nameMode,
}: {
  artists: ArtistCard[];
  token: string;
  nameMode: NameMode;
}) {
  // "" on the server and until hydration, so the first paint is curator order
  // and the per-device shuffle applies straight after.
  const respondentId = useSyncExternalStore(subscribe, getRespondentId, () => "");
  const firstName = useSyncExternalStore(subscribe, getFirstName, () => "");
  const [mine, setMine] = useState<Mine | null>(null);

  const ordered = useMemo(
    () => (respondentId ? seededOrder(artists, respondentId) : artists),
    [artists, respondentId]
  );

  useEffect(() => {
    if (!respondentId) return;
    let live = true;
    loadMyReactions(token, respondentId).then((rows) => {
      if (!live) return;
      setMine(Object.fromEntries(rows.map((r) => [r.artist_id, { reaction: r.reaction, comment: r.comment ?? "" }])));
    });
    return () => {
      live = false;
    };
  }, [token, respondentId]);

  return (
    <div className="space-y-10">
      {nameMode !== "off" && (
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="block font-medium">
            Your first name{nameMode === "optional" && <span className="font-normal text-muted-foreground"> (optional)</span>}
          </label>
          <input
            id="firstName"
            className={field}
            maxLength={60}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Only Patronage sees names. Rabobank receives a summary of what the team said, without names.
          </p>
        </div>
      )}

      {ordered.map((artist) => {
        const site = safeUrl(artist.website_url);
        return (
          <article key={artist.id} className="space-y-4" aria-labelledby={`artist-${artist.id}`}>
            <header className="space-y-1">
              <h2 id={`artist-${artist.id}`} className="text-xl font-semibold">{artist.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[artist.region, artist.medium].filter(Boolean).join(" · ")}
              </p>
              {site && (
                <a href={site} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                  View their website
                </a>
              )}
            </header>
            {artist.curator_note && <p className="text-sm leading-relaxed">{artist.curator_note}</p>}
            <Gallery works={artist.works} artistName={artist.name} />
            {/* Wait for stored reactions so the buttons start in the right state. */}
            {mine === null && respondentId ? (
              <p className="text-sm text-muted-foreground">Loading your responses…</p>
            ) : (
              <ArtistReaction
                key={`${artist.id}-${mine ? "ready" : "wait"}`}
                artist={artist}
                token={token}
                respondentId={respondentId}
                firstName={firstName}
                nameMode={nameMode}
                initial={mine?.[artist.id]}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
