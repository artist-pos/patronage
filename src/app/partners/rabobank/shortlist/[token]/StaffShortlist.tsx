"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Gallery } from "../../_components/Gallery";
import { WallViewer } from "@/components/rabobank/WallViewer";
import { KiwiConfetti, prepareKiwiConfetti } from "../../survey/[token]/KiwiConfetti";
import "../../survey/[token]/survey.css";
import { getFirstName, getRespondentId, seededOrder, setFirstName, subscribe } from "@/lib/rabobank/respondent";
import { REACTIONS, type ArtistCard } from "@/lib/rabobank/shortlist";
import type { NameMode } from "@/lib/rabobank/settings";
import { loadMyReactions, saveReaction } from "./actions";

type Answer = { reaction: string; comment: string };
const eyebrow = "text-xs font-medium uppercase tracking-widest";

/** One artist's response card: who they are at a glance, then the three choices and a comment. */
function ResponseCard({
  artist,
  answer,
  blocked,
  onChange,
  status,
}: {
  artist: ArtistCard;
  answer: Answer;
  blocked: boolean;
  onChange: (next: Answer, commit: boolean) => void;
  status: "" | "saving" | "saved" | "error";
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5">
      <header className="flex items-center gap-3">
        {artist.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.photo_url} alt="" className="shrink-0 rounded-full object-cover" style={{ height: "3rem", width: "3rem" }} />
        )}
        <div className="min-w-0">
          <h3 className="truncate text-lg font-medium">{artist.name}</h3>
          {artist.region && <p className="truncate text-xs text-stone-500">{artist.region}</p>}
        </div>
      </header>
      <Gallery works={artist.works.slice(0, 8)} artistName={artist.name} artistPhoto={artist.photo_url} layout="thumbs" />
      <fieldset className="mt-auto space-y-2 border-t border-stone-100 pt-4" disabled={blocked}>
        <legend className="mb-2 text-sm font-medium">For this space, this work&hellip;</legend>
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map((r) => (
            <label
              key={r.key}
              className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors ${
                answer.reaction === r.key ? "border-black bg-black text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
              } ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`reaction-${artist.id}`}
                checked={answer.reaction === r.key}
                onChange={() => onChange({ ...answer, reaction: r.key }, true)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <label className="block pt-2 text-sm">
          <span className="text-stone-600">Why? <span className="text-stone-400">(optional)</span></span>
          <textarea
            rows={2}
            maxLength={500}
            value={answer.comment}
            onChange={(e) => onChange({ ...answer, comment: e.target.value }, false)}
            onBlur={() => answer.reaction && onChange(answer, true)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus-visible:border-black"
            placeholder="A sentence is plenty."
          />
        </label>
        <p className="min-h-5 text-xs" role="status" aria-live="polite">
          {status === "saving" && <span className="text-stone-500">Saving…</span>}
          {status === "saved" && <span className="text-emerald-700">Saved</span>}
          {status === "error" && <span className="text-red-700">That didn&rsquo;t save. Please try again.</span>}
        </p>
      </fieldset>
    </article>
  );
}

/**
 * The staff shortlist: meet the artists, see their work on the wall, then
 * respond to each. Answers save as they are chosen; Send just says thanks.
 * No prices are ever loaded here.
 */
export function StaffShortlist({
  artists,
  token,
  nameMode,
  intro,
  closes,
}: {
  artists: ArtistCard[];
  token: string;
  nameMode: NameMode;
  intro: string;
  closes: string | null;
}) {
  // "" on the server and until hydration, so the first paint is curator order.
  const respondentId = useSyncExternalStore(subscribe, getRespondentId, () => "");
  const firstName = useSyncExternalStore(subscribe, getFirstName, () => "");
  const ordered = useMemo(() => (respondentId ? seededOrder(artists, respondentId) : artists), [artists, respondentId]);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [status, setStatus] = useState<Record<string, "" | "saving" | "saved" | "error">>({});
  const [sent, setSent] = useState(false);
  const [burst, setBurst] = useState(0);
  const blocked = nameMode === "required" && !firstName.trim();

  useEffect(() => {
    if (!respondentId) return;
    let live = true;
    loadMyReactions(token, respondentId).then((rows) => {
      if (live) setAnswers(Object.fromEntries(rows.map((r) => [r.artist_id, { reaction: r.reaction, comment: r.comment ?? "" }])));
    });
    return () => { live = false; };
  }, [token, respondentId]);

  async function change(artistId: string, next: Answer, commit: boolean) {
    setAnswers((a) => ({ ...a, [artistId]: next }));
    if (!commit || !next.reaction) return;
    setStatus((s) => ({ ...s, [artistId]: "saving" }));
    const r = await saveReaction({ token, artistId, respondentId, firstName, reaction: next.reaction, comment: next.comment });
    setStatus((s) => ({ ...s, [artistId]: r.ok ? "saved" : "error" }));
  }

  // Counts only answers that are saved (or came back from the server), so Send never thanks someone for nothing.
  const answered = ordered.filter((a) => answers[a.id]?.reaction && !["saving", "error"].includes(status[a.id] ?? "")).length;
  const allAnswered = answered === ordered.length && ordered.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-stone-900">
      {burst > 0 && <KiwiConfetti key={burst} />}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
        {/* Welcome */}
        <section className="flex min-h-[80vh] flex-col justify-center gap-8 py-14 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl space-y-5 lg:w-[30rem] lg:shrink-0">
            <p className={`${eyebrow} text-[#000FAA]`}>Rabobank Te Puke · Event space artwork</p>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl">Meet the shortlisted artists</h1>
            <p className="text-lg leading-relaxed text-stone-600">{intro}</p>
            <ol className="space-y-1.5 text-stone-600">
              <li><span className="mr-2 text-stone-400">1</span>Meet the {ordered.length} artists and their work</li>
              <li><span className="mr-2 text-stone-400">2</span>See how their work sits on the wall</li>
              <li><span className="mr-2 text-stone-400">3</span>Tell us what you think of each</li>
            </ol>
            {nameMode !== "off" && (
              <label className="block max-w-sm space-y-1.5 pt-2">
                <span className="font-medium">Your first name{nameMode === "optional" && <span className="font-normal text-stone-400"> (optional)</span>}</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={60}
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus-visible:border-black"
                />
                <span className="block text-xs text-stone-500">Only Patronage sees names. Rabobank gets a summary, without names.</span>
              </label>
            )}
            <a href="#artist-1" className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-3 text-white hover:opacity-85">
              Begin <span aria-hidden="true">↓</span>
            </a>
            {closes && <p className="text-sm text-stone-500">Responses close {closes}.</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rabobank-pilot/room.webp" alt="The Te Puke event space" className="w-full min-w-0 max-w-3xl rounded-[4px] shadow-xl lg:flex-1" />
        </section>

        {/* The artists, one at a time */}
        {ordered.map((a, i) => (
          <section key={a.id} id={`artist-${i + 1}`} className="scroll-mt-6 border-t border-stone-200 py-16" aria-labelledby={`name-${a.id}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
              <div className="space-y-5">
                <p className={`${eyebrow} text-stone-400`}>Artist {i + 1} of {ordered.length}</p>
                <div className="flex items-center gap-4">
                  {a.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo_url} alt="" className="shrink-0 rounded-full object-cover" style={{ height: "5rem", width: "5rem" }} />
                  )}
                  <div>
                    <h2 id={`name-${a.id}`} className="text-3xl font-medium">{a.name}</h2>
                    {a.region && <p className="text-sm text-stone-500">{a.region}</p>}
                  </div>
                </div>
                {a.curator_note && (
                  <div className="space-y-1.5 rounded-lg border-l-2 border-[#000FAA] bg-white/70 py-3 pl-4 pr-3">
                    <p className={`${eyebrow} text-[#000FAA]`}>From Blake</p>
                    <p className="whitespace-pre-line text-lg leading-relaxed">{a.curator_note}</p>
                  </div>
                )}
                {a.bio && <p className="whitespace-pre-line leading-relaxed text-stone-600">{a.bio}</p>}
                {a.staff_prompt_answer && (
                  <blockquote className="border-l-2 border-[#FF6700]/60 pl-4 text-stone-600">
                    <p className="mb-1 text-xs text-stone-400">What they&rsquo;d like someone to feel in front of their work</p>
                    {a.staff_prompt_answer}
                  </blockquote>
                )}
              </div>
              <Gallery works={a.works} artistName={a.name} artistPhoto={a.photo_url} layout="natural" />
            </div>
          </section>
        ))}

        {/* The wall */}
        <section className="border-t border-stone-200 py-16" aria-labelledby="wall">
          <p className={`${eyebrow} text-stone-400`}>On the wall</p>
          <h2 id="wall" className="mb-6 mt-2 text-3xl font-medium">See their work in the room</h2>
          <div className="max-w-5xl">
            <WallViewer
              initialSize="small"
              table={false}
              heading=""
              intro="The wall is dark blue, 3600mm long and 2400mm high, and the work will be about 1600 × 800mm. Choose a work from each artist to hang it on the wall, and turn the table on to see it in the room."
              choices={ordered.map((a) => ({ artist: a.name, works: a.works.map((w) => ({ id: w.id, title: w.title, url: w.image_url })) }))}
            />
          </div>
        </section>

        {/* Responses */}
        <section className="border-t border-stone-200 py-16" aria-labelledby="respond">
          <p className={`${eyebrow} text-stone-400`}>Your response</p>
          <h2 id="respond" className="mt-2 text-3xl font-medium">What do you think?</h2>
          <p className="mb-8 mt-2 max-w-2xl text-stone-600">
            Choose a response for each artist. There are no wrong answers, and your input shapes the recommendation. It isn&rsquo;t a vote.
          </p>
          {blocked && <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Add your first name at the top of the page to respond.</p>}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((a) => (
              <ResponseCard
                key={a.id}
                artist={a}
                answer={answers[a.id] ?? { reaction: "", comment: "" }}
                blocked={blocked}
                status={status[a.id] ?? ""}
                onChange={(next, commit) => void change(a.id, next, commit)}
              />
            ))}
          </div>

          <div className="mt-10 space-y-3">
            {sent ? (
              <div className="max-w-xl space-y-2" role="status">
                <p className="text-2xl font-medium">Thank you{firstName.trim() ? `, ${firstName.trim()}` : ""}.</p>
                <p className="text-stone-600">Your responses are in. You can change them on this page until responses close.</p>
                <p className="pt-2 text-stone-500">&mdash; Blake Aitken, Patronage</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!allAnswered || blocked}
                  onClick={() => { prepareKiwiConfetti(); setSent(true); setBurst((n) => n + 1); }}
                  className="rounded-lg bg-black px-6 py-3 text-white hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send my responses
                </button>
                <p className="text-sm text-stone-500">{answered} of {ordered.length} answered{allAnswered ? "" : ". Choose a response for each artist to send."}</p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
