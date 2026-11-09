"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Gallery } from "../../_components/Gallery";
import { WallViewer } from "@/components/rabobank/WallViewer";
import { KiwiConfetti, prepareKiwiConfetti } from "../../survey/[token]/KiwiConfetti";
import { Scene, Writing, useTween } from "../../survey/[token]/SurveyExperience";
import "../../survey/[token]/survey.css";
import "./staff.css";
import { getFirstName, getRespondentId, setFirstName, subscribe } from "@/lib/rabobank/respondent";
import type { ArtistCard } from "@/lib/rabobank/shortlist";
import type { NameMode } from "@/lib/rabobank/settings";
import { loadMyReactions, saveReaction } from "./actions";

type Answer = { score: number | null; comment: string };
type SaveState = "" | "saving" | "saved" | "error";

/** Answers given before the 1 to 10 scale (migration 220) come back as the middle of their band. */
const LEGACY_SCORE: Record<string, number> = { not_for_space: 2, unsure: 5, speaks: 9 };

/** The bio's first sentence (or so), with the rest behind "Read more". */
function Bio({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const m = text.match(/^[\s\S]{40,220}?[.!?](?=\s|$)/);
  const lead = (m?.[0] ?? text.slice(0, 200)).trim();
  const rest = text.slice(lead.length).trim();
  return (
    <div className="rb-st-block">
      <p className="rb-st-label">About the artist</p>
      <p className="rb-copy rb-st-bio">
        {lead}
        {rest && !open && "…"}
        {rest && open && <> {rest}</>}
      </p>
      {rest && (
        <button type="button" className="rb-back" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/** The survey's own buttons: black Next with its arrow, Back small and out of the way. */
function Actions({ onNext, nextLabel = "Next", nextDisabled, onBack, hint }: { onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; onBack?: () => void; hint?: string }) {
  return (
    <div className="rb-actions">
      {onNext && (
        <button type="button" className="rb-next" onClick={onNext} disabled={nextDisabled}>
          {nextLabel} <span className="rb-arrow" aria-hidden="true" />
        </button>
      )}
      {hint && <span className="rb-st-hint">{hint}</span>}
      {onBack && (
        <span className="rb-quiet">
          <button type="button" className="rb-link" onClick={onBack}>Back</button>
        </span>
      )}
    </div>
  );
}

/** 1 to 10 as pebbles, with the three words along the bottom: 1 not for this space, 10 speaks to me. */
function Scale({ name, value, onPick, label }: { name: string; value: number | null; onPick: (n: number) => void; label: string }) {
  return (
    <div className="rb-st-scale">
      <div className="rb-st-scale-row" role="radiogroup" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <label key={n} className="rb-pebble rb-st-num">
            <input type="radio" name={name} checked={value === n} onChange={() => onPick(n)} aria-label={`${n} out of 10`} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <div className="rb-st-scale-ends" aria-hidden="true">
        <span><b className="rb-st-n">1 · </b>Not for this space</span>
        <span className="rb-st-mid">Not sure</span>
        <span><b className="rb-st-n">10 · </b>Speaks to me</span>
      </div>
    </div>
  );
}

/** One artist's response: who they are at a glance, the scale, and why. */
function ResponseCard({ artist, answer, blocked, onChange, status }: {
  artist: ArtistCard;
  answer: Answer;
  blocked: boolean;
  onChange: (next: Answer, commit: boolean) => void;
  status: SaveState;
}) {
  return (
    <article className="rb-st-card">
      <header className="rb-st-who">
        {artist.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.photo_url} alt="" className="rb-st-face" />
        )}
        <div>
          <h3 className="rb-st-name">{artist.name}</h3>
          {artist.region && <p className="rb-st-place">{artist.region}</p>}
        </div>
      </header>
      <Gallery works={artist.works.slice(0, 8)} artistName={artist.name} artistPhoto={artist.photo_url} layout="thumbs" />
      <fieldset className="rb-st-answer" disabled={blocked}>
        <legend className="rb-st-label">For this space, how does this work sit with you?</legend>
        <Scale name={`score-${artist.id}`} value={answer.score} onPick={(n) => onChange({ ...answer, score: n }, true)} label={`${artist.name}, from 1 (not for this space) to 10 (speaks to me)`} />
        <p className="rb-st-label">Why? <span className="rb-st-soft">optional</span></p>
        <div onBlur={() => answer.score && onChange(answer, true)}>
          <Writing
            id={`why-${artist.id}`}
            small
            value={answer.comment}
            onChange={(v) => onChange({ ...answer, comment: v }, false)}
            limit={500}
            label={`Why, for ${artist.name}`}
            placeholder="A sentence is plenty."
            onEnter={() => answer.score && onChange(answer, true)}
          />
        </div>
        <p className="rb-st-saved" role="status" aria-live="polite" data-state={status}>
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "That didn’t save. Please try again." : ""}
        </p>
      </fieldset>
    </article>
  );
}

/**
 * The staff shortlist, one step at a time in the survey's own design: welcome,
 * name, each artist in curator order, the wall, then a response for each.
 * Answers save as they are chosen; Send just says thanks. No prices here.
 */
export function StaffShortlist({
  artists,
  responses,
  token,
  nameMode,
  intro,
  closes,
}: {
  artists: ArtistCard[];
  /** Each artist's own response to the brief, by artist id. */
  responses: Record<string, string>;
  token: string;
  nameMode: NameMode;
  intro: string;
  closes: string | null;
}) {
  const respondentId = useSyncExternalStore(subscribe, getRespondentId, () => "");
  const firstName = useSyncExternalStore(subscribe, getFirstName, () => "");

  const askName = nameMode !== "off";
  const steps = useMemo(
    () => [
      { kind: "welcome" as const },
      ...(askName ? [{ kind: "name" as const }] : []),
      ...artists.map((a) => ({ kind: "artist" as const, artist: a })),
      { kind: "wall" as const },
      { kind: "respond" as const },
    ],
    [artists, askName]
  );
  const [idx, setIdx] = useState(0);
  const p = useTween(idx / (steps.length - 1), 1800);
  const go = (n: number) => {
    setIdx(Math.max(0, Math.min(steps.length - 1, n)));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(idx + 1);
  const back = () => go(idx - 1);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [sent, setSent] = useState(false);
  const [burst, setBurst] = useState(0);
  const blocked = nameMode === "required" && !firstName.trim();

  useEffect(() => {
    if (!respondentId) return;
    let live = true;
    loadMyReactions(token, respondentId).then((rows) => {
      if (live) setAnswers(Object.fromEntries(rows.map((r) => [r.artist_id, { score: r.score ?? LEGACY_SCORE[r.reaction] ?? null, comment: r.comment ?? "" }])));
    });
    return () => { live = false; };
  }, [token, respondentId]);

  async function change(artistId: string, nextAnswer: Answer, commit: boolean) {
    setAnswers((a) => ({ ...a, [artistId]: nextAnswer }));
    if (!commit || !nextAnswer.score) return;
    setStatus((s) => ({ ...s, [artistId]: "saving" }));
    const r = await saveReaction({ token, artistId, respondentId, firstName, score: nextAnswer.score, comment: nextAnswer.comment });
    setStatus((s) => ({ ...s, [artistId]: r.ok ? "saved" : "error" }));
  }

  // Counts only answers that are saved (or came back from the server), so Send never thanks someone for nothing.
  const answered = artists.filter((a) => answers[a.id]?.score && !["saving", "error"].includes(status[a.id] ?? "")).length;
  const allAnswered = answered === artists.length && artists.length > 0;
  const step = steps[idx];
  const wide = step.kind !== "name";

  let body: React.ReactNode = null;
  if (step.kind === "welcome") {
    body = (
      <div className="rb-intro">
        <div>
          <p className="rb-eyebrow">Rabobank Te Puke &middot; Event Space Artwork</p>
          <h1 className="rb-title">Kia ora,</h1>
          <p className="rb-copy">{intro}</p>
          <p className="rb-copy">
            You&rsquo;ll meet each of the {artists.length} artists and their work, see how it sits on the wall, then tell us what you think of each.
            It takes about five minutes{closes ? `, and responses close ${closes}` : ""}.
          </p>
          <Actions onNext={next} nextLabel="Begin" />
        </div>
        <figure className="rb-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rabobank-pilot/room.webp" alt="A render of the Te Puke event space, with a table at its centre and the focal wall on the left" width={684} height={384} />
          <div className="rb-figmeta">
            <figcaption>The event space</figcaption>
            {/* The official Rabobank wordmark, unaltered. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rb-mark" src="/rabobank-pilot/rabobank-wordmark.png" alt="Rabobank" width={401} height={76} />
          </div>
        </figure>
      </div>
    );
  } else if (step.kind === "name") {
    body = (
      <>
        <p className="rb-eyebrow">Before you start{nameMode === "optional" ? " · optional" : ""}</p>
        <h2 className="rb-title" id="rb-q">What&rsquo;s your first name?</h2>
        <p className="rb-help">Only Patronage sees names. Rabobank gets a summary of what the team said, without names.</p>
        <Writing id="rb-name" small value={firstName} onChange={setFirstName} limit={60} label="Your first name" placeholder="Your first name" autoFocus onEnter={() => { if (!blocked) next(); }} />
        <Actions onNext={next} nextDisabled={blocked} onBack={back} />
      </>
    );
  } else if (step.kind === "artist") {
    const a = step.artist;
    const n = artists.indexOf(a) + 1;
    body = (
      <>
        <div className="rb-st-artist">
          <div>
            <p className="rb-eyebrow">Artist {n} of {artists.length}</p>
            <div className="rb-st-who rb-st-who--big">
              {a.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photo_url} alt="" className="rb-st-face rb-st-face--big" />
              )}
              <div>
                <h2 className="rb-title rb-st-title">{a.name}</h2>
                {a.region && <p className="rb-st-place">{a.region}</p>}
              </div>
            </div>
            {a.curator_note && (
              <div className="rb-st-note">
                <p className="rb-st-label rb-st-label--blue">From Blake</p>
                <p className="rb-copy">{a.curator_note}</p>
              </div>
            )}
            {responses[a.id] && (
              <div className="rb-st-block">
                <p className="rb-st-label">In their words: their idea for the wall</p>
                <p className="rb-copy rb-st-words">{responses[a.id]}</p>
              </div>
            )}
            {a.bio && <Bio text={a.bio} />}
            {a.staff_prompt_answer && (
              <div className="rb-st-block">
                <p className="rb-st-label">What they&rsquo;d like you to feel in front of their work</p>
                <p className="rb-copy rb-st-feel">{a.staff_prompt_answer}</p>
              </div>
            )}
          </div>
          <Gallery works={a.works} artistName={a.name} artistPhoto={a.photo_url} layout="natural" />
        </div>
        <Actions onNext={next} nextLabel={n < artists.length ? "Next artist" : "See them on the wall"} onBack={back} />
      </>
    );
  } else if (step.kind === "wall") {
    body = (
      <>
        <p className="rb-eyebrow">On the wall</p>
        <h2 className="rb-title">See their work in the room</h2>
        <p className="rb-help">
          The wall is dark blue, 3600mm long and 2400mm high, and the work will be about 1600 &times; 800mm. Choose a work from each artist to hang it,
          and turn the table on to see it in the room.
        </p>
        <WallViewer
          initialSize="small"
          table={false}
          heading=""
          intro=""
          choices={artists.map((a) => ({ artist: a.name, works: a.works.map((w) => ({ id: w.id, title: w.title, url: w.image_url })) }))}
        />
        <Actions onNext={next} nextLabel="Tell us what you think" onBack={back} />
      </>
    );
  } else {
    body = sent ? (
      <div className="rb-st-thanks" role="status">
        <p className="rb-eyebrow">Sent</p>
        <h2 className="rb-title">Thank you{firstName.trim() ? `, ${firstName.trim()}` : ""}.</h2>
        <p className="rb-copy">Your responses are in. You can come back to this link and change them until responses close.</p>
        <div className="rb-signoff">
          <p className="rb-sign">&mdash; Blake Aitken</p>
        </div>
      </div>
    ) : (
      <>
        <p className="rb-eyebrow">Your response</p>
        <h2 className="rb-title">What do you think?</h2>
        <p className="rb-help">
          For each artist, choose a number: 1 if the work isn&rsquo;t right for this space, 10 if it really speaks to you. There are no wrong answers, and your
          input shapes the recommendation. It isn&rsquo;t a vote.
        </p>
        {blocked && (
          <p className="rb-st-warn">
            Add your first name to respond. <button type="button" className="rb-back" onClick={() => go(1)}>Add it now</button>
          </p>
        )}
        <div className="rb-st-cards">
          {artists.map((a) => (
            <ResponseCard
              key={a.id}
              artist={a}
              answer={answers[a.id] ?? { score: null, comment: "" }}
              blocked={blocked}
              status={status[a.id] ?? ""}
              onChange={(nx, commit) => void change(a.id, nx, commit)}
            />
          ))}
        </div>
        <Actions
          onNext={() => { prepareKiwiConfetti(); setSent(true); setBurst((x) => x + 1); window.scrollTo({ top: 0 }); }}
          nextLabel="Send my responses"
          nextDisabled={!allAnswered || blocked}
          hint={allAnswered ? undefined : `${answered} of ${artists.length} answered`}
          onBack={back}
        />
      </>
    );
  }

  return (
    <div className="rb rb-st" style={{ ["--p" as string]: p }}>
      <Scene p={p} />
      {burst > 0 && <KiwiConfetti key={burst} />}
      <div className="rb-stage rb-st-stage">
        <div className={`rb-col rb-in${wide ? " rb-col--wide rb-st-wide" : ""}`} key={idx}>
          {body}
        </div>
      </div>
    </div>
  );
}
