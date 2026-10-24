"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/rabobank/artist-copy";
import {
  BIO_WORDS,
  PROFILE_LIMITS,
  WORKS,
  wordCount,
  type ProfileDraft,
  type ProfileErrors,
  type WorkDraft,
} from "@/lib/rabobank/artist-profile";
import { removePhoto, removeWork, saveProfileDraft, submitProfile } from "./actions";
import { Counter, Field, Pills, SaveIndicator, inputClass, primaryButton, quietButton, uploadImage, useAutosave } from "./ui";

const C = COPY.partTwo;
const errorText = (code?: string) => (code ? (C.errors as Record<string, string>)[code] ?? C.errors.name : undefined);
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function PartTwoForm({
  token,
  initial,
  initialWorks,
  hasEmail,
  disabled,
}: {
  token: string;
  initial: ProfileDraft;
  initialWorks: WorkDraft[];
  hasEmail: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState<ProfileDraft>(initial);
  const [works, setWorks] = useState<WorkDraft[]>(initialWorks);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ProfileErrors & { email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "photo" | "work" | "send">("");
  const snapshot = useMemo(() => ({ p, works }), [p, works]);
  const status = useAutosave(snapshot, `rb-profile-${token}`, (v) => saveProfileDraft(token, v.p, v.works), !disabled);
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const setWork = (id: string, k: keyof WorkDraft, v: string) => setWorks((ws) => ws.map((w) => (w.id === id ? { ...w, [k]: v } : w)));
  const words = wordCount(p.bio);

  async function onPhoto(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy("photo");
    const r = await uploadImage(token, "photo", f);
    setBusy("");
    if (r.ok) set("photo_url", r.data.url);
    else setFormError(r.error);
  }

  async function onWorks(files: FileList | null) {
    if (!files?.length) return;
    setBusy("work");
    setFormError(null);
    for (const f of Array.from(files).slice(0, WORKS.max - works.length)) {
      const r = await uploadImage<{ work: WorkDraft }>(token, "work", f);
      if (r.ok) setWorks((ws) => [...ws, r.data.work]);
      else { setFormError(r.error); break; }
    }
    setBusy("");
  }

  async function onRemoveWork(id: string) {
    setWorks((ws) => ws.filter((w) => w.id !== id));
    await removeWork(token, id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("send");
    setFormError(null);
    const r = await submitProfile(token, p, works, email);
    setBusy("");
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setFormError(r.error === "closed" ? C.errors.closed : C.errors.name);
      return;
    }
    try { localStorage.removeItem(`rb-profile-${token}`); } catch { /* fine */ }
    router.push(`/partners/rabobank/artists/${token}/done${r.keepSent ? "?keep=1" : ""}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-9" noValidate>
      <Field label={C.q.photo.label} help={C.q.photo.help}>
        <div className="flex items-center gap-4">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" className="size-20 rounded-full border border-stone-200 object-cover" />
          ) : (
            <span className="size-20 rounded-full border border-dashed border-stone-300 bg-white" aria-hidden="true" />
          )}
          <label className={`${quietButton} cursor-pointer ${busy || disabled ? "pointer-events-none opacity-50" : ""}`}>
            {busy === "photo" ? COPY.saving.saving : C.work.add}
            <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { void onPhoto(e.target.files); e.target.value = ""; }} />
          </label>
          {p.photo_url && (
            <button type="button" className="text-sm text-stone-500 underline underline-offset-4" onClick={() => { set("photo_url", ""); void removePhoto(token); }} disabled={disabled}>
              {COPY.partTwo.work.remove}
            </button>
          )}
        </div>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={C.q.name.label} help={C.q.name.help} required error={errorText(errors.name)} htmlFor="name">
          <input id="name" autoComplete="name" className={inputClass} maxLength={PROFILE_LIMITS.name} value={p.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} />
        </Field>
        <Field label={C.q.location.label} help={C.q.location.help} htmlFor="location">
          <input id="location" className={inputClass} maxLength={PROFILE_LIMITS.location} value={p.location} onChange={(e) => set("location", e.target.value)} disabled={disabled} />
        </Field>
      </div>

      <Field label={C.q.bio.label} help={C.q.bio.help} required error={errorText(errors.bio)} htmlFor="bio">
        <textarea id="bio" rows={7} className={inputClass} maxLength={PROFILE_LIMITS.bio} value={p.bio} onChange={(e) => set("bio", e.target.value)} disabled={disabled} />
        <p className={`text-right text-xs ${words && (words < BIO_WORDS.min || words > BIO_WORDS.max) ? "text-amber-700" : "text-stone-400"}`}>
          {C.words(words)}
        </p>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={C.q.website.label} htmlFor="website">
          <input id="website" inputMode="url" autoComplete="url" className={inputClass} maxLength={PROFILE_LIMITS.website} value={p.website} onChange={(e) => set("website", e.target.value)} disabled={disabled} />
        </Field>
        <Field label={C.q.instagram.label} htmlFor="instagram">
          <input id="instagram" className={inputClass} maxLength={PROFILE_LIMITS.instagram + 30} value={p.instagram} onChange={(e) => set("instagram", e.target.value)} disabled={disabled} />
        </Field>
      </div>
      <Field label={C.q.otherLinks.label} htmlFor="links">
        <textarea id="links" rows={2} className={inputClass} maxLength={PROFILE_LIMITS.otherLinks} value={p.other_links} onChange={(e) => set("other_links", e.target.value)} disabled={disabled} />
      </Field>

      <Field label={C.q.works.label} help={C.q.works.help} required error={errorText(errors.works)}>
        <ul className="space-y-5">
          {works.map((w, i) => (
            <li key={w.id} className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-[8rem_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.thumb_url ?? w.image_url} alt="" className="w-full rounded-lg sm:w-32" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input aria-label={`${C.work.title} ${i + 1}`} placeholder={C.work.title} className={inputClass} maxLength={PROFILE_LIMITS.workTitle} value={w.title} onChange={(e) => setWork(w.id, "title", e.target.value)} disabled={disabled} />
                <input aria-label={`${C.work.year} ${i + 1}`} placeholder={C.work.year} inputMode="numeric" className={inputClass} maxLength={PROFILE_LIMITS.workYear} value={w.year} onChange={(e) => setWork(w.id, "year", e.target.value)} disabled={disabled} />
                <input aria-label={`${C.work.medium} ${i + 1}`} placeholder={C.work.medium} className={inputClass} maxLength={PROFILE_LIMITS.workMedium} value={w.medium} onChange={(e) => setWork(w.id, "medium", e.target.value)} disabled={disabled} />
                <input aria-label={`${C.work.size} ${i + 1}`} placeholder={C.work.size} className={inputClass} maxLength={PROFILE_LIMITS.workSize} value={w.size} onChange={(e) => setWork(w.id, "size", e.target.value)} disabled={disabled} />
                <input aria-label={`${C.work.note} ${i + 1}`} placeholder={C.work.note} className={`${inputClass} sm:col-span-2`} maxLength={PROFILE_LIMITS.workNote} value={w.note} onChange={(e) => setWork(w.id, "note", e.target.value)} disabled={disabled} />
                <button type="button" className="justify-self-start text-sm text-stone-500 underline underline-offset-4" onClick={() => void onRemoveWork(w.id)} disabled={disabled}>
                  {C.work.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {works.length < WORKS.max && (
          <label className={`${quietButton} mt-3 cursor-pointer ${busy || disabled ? "pointer-events-none opacity-50" : ""}`}>
            {busy === "work" ? COPY.saving.saving : C.work.add}
            <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => { void onWorks(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <p className="text-xs text-stone-400">{C.worksCount(works.length, WORKS.min, WORKS.max)}</p>
      </Field>

      <Field label={C.q.staffPrompt.label} help={C.q.staffPrompt.help} htmlFor="prompt">
        <textarea id="prompt" rows={3} className={inputClass} maxLength={PROFILE_LIMITS.staffPrompt} value={p.staff_prompt_answer} onChange={(e) => set("staff_prompt_answer", e.target.value)} disabled={disabled} />
        <Counter value={p.staff_prompt_answer} max={PROFILE_LIMITS.staffPrompt} />
      </Field>

      <Field label={C.q.choice.label} required error={errorText(errors.visibility_choice)}>
        <Pills name="choice" label={C.q.choice.label} value={p.visibility_choice} options={C.choices} onChange={(v) => set("visibility_choice", v)} disabled={disabled} />
        {p.visibility_choice === "keep" && !hasEmail && (
          <div className="mt-3 max-w-sm">
            <label htmlFor="keep-email" className="mb-1 block text-sm">{C.q.keepEmail.label}</label>
            <input id="keep-email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
            {errors.email && <p className="mt-1 text-sm text-red-700" role="alert">{C.errors.email}</p>}
          </div>
        )}
      </Field>

      <Field label={C.q.consent.label} required error={errorText(errors.consent)}>
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-600">
          {C.q.consent.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-black" checked={p.consent} onChange={(e) => set("consent", e.target.checked)} disabled={disabled} />
          <span>{C.q.consent.label}</span>
        </label>
      </Field>

      {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={primaryButton} disabled={!!busy || disabled}>
          {busy === "send" ? COPY.saving.saving : C.submit}
        </button>
        <SaveIndicator status={status} />
      </div>
    </form>
  );
}
