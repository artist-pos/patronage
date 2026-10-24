"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/rabobank/artist-copy";
import { QUOTE_LIMITS, type QuoteDraft, type QuoteErrors } from "@/lib/rabobank/quote";
import { saveQuoteDraft, submitQuote } from "./actions";
import { Counter, Field, Pills, SaveIndicator, inputClass, primaryButton, quietButton, uploadImage, useAutosave } from "./ui";

const C = COPY.partOne;
const errorText = (code?: string) => (code ? (C.errors as Record<string, string>)[code] ?? C.errors.required : undefined);

export function PartOneForm({
  token,
  initial,
  disabled,
  onDeclined,
}: {
  token: string;
  initial: QuoteDraft;
  disabled: boolean;
  onDeclined: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState<QuoteDraft>(initial);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const status = useAutosave(q, `rb-quote-${token}`, (v) => saveQuoteDraft(token, v), !disabled);
  const set = <K extends keyof QuoteDraft>(k: K, v: QuoteDraft[K]) => setQ((cur) => ({ ...cur, [k]: v }));
  const declining = q.interested === "no";

  async function addExisting(files: FileList | null) {
    const file = files?.[0];
    if (!file || q.existing_work_images.length >= 2) return;
    setUploading(true);
    const r = await uploadImage(token, "quote_existing", file);
    setUploading(false);
    if (r.ok) set("existing_work_images", [...q.existing_work_images, r.data.url].slice(0, 2));
    else setFormError(r.error);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setFormError(null);
    const r = await submitQuote(token, q);
    setSending(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setFormError(r.error === "closed" ? C.errors.closed : r.error === "invalid" ? C.errors.required : C.errors.required);
      return;
    }
    try { localStorage.removeItem(`rb-quote-${token}`); } catch { /* fine */ }
    if (r.declined) onDeclined();
    else router.push(`/partners/rabobank/artists/${token}/thanks`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-9" noValidate>
      <Field label={C.q.interested.label} help={C.q.interested.help} required error={errorText(errors.interested)}>
        <Pills name="interested" label={C.q.interested.label} value={q.interested} options={C.options.interested} onChange={(v) => set("interested", v)} disabled={disabled} />
      </Field>

      {q.interested === "yes_with_questions" && (
        <Field label={C.q.questions.label} help={C.q.questions.help} htmlFor="questions">
          <textarea id="questions" rows={3} className={inputClass} maxLength={QUOTE_LIMITS.questions} value={q.questions_text} onChange={(e) => set("questions_text", e.target.value)} disabled={disabled} />
        </Field>
      )}

      {!declining && q.interested && (
        <>
          <Field label={C.q.deliver.label} help={C.q.deliver.help} required error={errorText(errors.deliver_by ?? errors.deliver_date)}>
            <Pills name="deliver" label={C.q.deliver.label} value={q.deliver_by} options={C.options.deliver} onChange={(v) => set("deliver_by", v)} disabled={disabled} />
            {q.deliver_by === "date" && (
              <input type="date" aria-label={C.q.deliver.label} className={`${inputClass} mt-2 max-w-xs`} value={q.deliver_date} onChange={(e) => set("deliver_date", e.target.value)} disabled={disabled} />
            )}
          </Field>

          <Field label={C.q.workType.label} help={C.q.workType.help} required error={errorText(errors.work_type)}>
            <Pills name="work_type" label={C.q.workType.label} value={q.work_type} options={C.options.workType} onChange={(v) => set("work_type", v)} disabled={disabled} />
          </Field>

          {(q.work_type === "existing" || q.work_type === "either") && (
            <Field label={C.q.existingImages.label} help={C.q.existingImages.help}>
              <div className="flex flex-wrap gap-3">
                {q.existing_work_images.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-28 w-auto rounded-lg border border-stone-200" />
                    <button type="button" className="mt-1 text-xs text-stone-500 underline underline-offset-4" onClick={() => set("existing_work_images", q.existing_work_images.filter((u) => u !== url))} disabled={disabled}>
                      {COPY.partTwo.work.remove}
                    </button>
                  </div>
                ))}
                {q.existing_work_images.length < 2 && (
                  <label className={`${quietButton} cursor-pointer ${uploading || disabled ? "pointer-events-none opacity-50" : ""}`}>
                    {uploading ? "Uploading" : COPY.partTwo.work.add}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => { void addExisting(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </Field>
          )}

          <Field label={C.q.approach.label} help={C.q.approach.help} required error={errorText(errors.approach_text)} htmlFor="approach">
            <textarea id="approach" rows={6} className={inputClass} value={q.approach_text} onChange={(e) => set("approach_text", e.target.value)} disabled={disabled} />
            <Counter value={q.approach_text} max={QUOTE_LIMITS.approach} />
          </Field>

          <fieldset className="space-y-4">
            <legend className="font-medium">{C.q.quote.label}</legend>
            <p className="text-sm text-stone-500">{C.q.quote.help}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={C.q.quote.fee1800} required error={errorText(errors.fee_1800x900)} htmlFor="fee1800">
                <Money id="fee1800" value={q.fee_1800x900} onChange={(v) => set("fee_1800x900", v)} disabled={disabled} />
              </Field>
              <Field label={C.q.quote.fee1600} error={errorText(errors.fee_1600x800)} htmlFor="fee1600">
                <Money id="fee1600" value={q.fee_1600x800} onChange={(v) => set("fee_1600x800", v)} disabled={disabled} />
              </Field>
            </div>
            <Field label={C.q.quote.gst} required={!!(q.fee_1800x900 || q.fee_1600x800)} error={errorText(errors.gst_inclusive)}>
              <Pills
                name="gst"
                label={C.q.quote.gst}
                value={q.gst_inclusive}
                options={[["included", C.q.quote.gstIncluded], ["excluded", C.q.quote.gstExcluded]] as const}
                onChange={(v) => set("gst_inclusive", v)}
                disabled={disabled}
              />
            </Field>
            <Field label={C.q.quote.altSize} htmlFor="altsize">
              <textarea id="altsize" rows={2} className={inputClass} maxLength={QUOTE_LIMITS.altSize} value={q.alt_size_note} onChange={(e) => set("alt_size_note", e.target.value)} disabled={disabled} />
            </Field>
          </fieldset>

          <WhoBlock
            prefix="framing"
            copy={C.q.framing}
            option={q.framing_option}
            cost={q.framing_cost}
            recommendation={q.framing_recommendation}
            costError={errorText(errors.framing_cost)}
            onOption={(v) => set("framing_option", v)}
            onCost={(v) => set("framing_cost", v)}
            onRecommendation={(v) => set("framing_recommendation", v)}
            disabled={disabled}
          />
          <WhoBlock
            prefix="install"
            copy={C.q.install}
            option={q.install_option}
            cost={q.install_cost}
            recommendation={q.install_recommendation}
            costError={errorText(errors.install_cost)}
            onOption={(v) => set("install_option", v)}
            onCost={(v) => set("install_cost", v)}
            onRecommendation={(v) => set("install_recommendation", v)}
            disabled={disabled}
          >
            <Field label={C.q.install.basedIn} htmlFor="basedin">
              <input id="basedin" className={inputClass} maxLength={QUOTE_LIMITS.basedIn} value={q.based_in} onChange={(e) => set("based_in", e.target.value)} disabled={disabled} />
            </Field>
          </WhoBlock>

          <Field label={C.q.leadTime.label} help={C.q.leadTime.help} error={errorText(errors.lead_time_weeks)} htmlFor="weeks">
            <input id="weeks" inputMode="numeric" className={`${inputClass} max-w-[8rem]`} value={q.lead_time_weeks} onChange={(e) => set("lead_time_weeks", e.target.value.replace(/[^\d]/g, "").slice(0, 3))} disabled={disabled} />
          </Field>

          <Field label={C.q.anythingElse.label} help={C.q.anythingElse.help} htmlFor="else">
            <textarea id="else" rows={3} className={inputClass} maxLength={QUOTE_LIMITS.anythingElse} value={q.anything_else} onChange={(e) => set("anything_else", e.target.value)} disabled={disabled} />
          </Field>
        </>
      )}

      {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={primaryButton} disabled={sending || disabled || !q.interested}>
          {sending ? COPY.saving.saving : C.submit}
        </button>
        <SaveIndicator status={status} />
      </div>
    </form>
  );
}

function Money({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">$</span>
      <input id={id} inputMode="decimal" className={`${inputClass} pl-7`} value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} disabled={disabled} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-400">NZD</span>
    </div>
  );
}

function WhoBlock({
  prefix,
  copy,
  option,
  cost,
  recommendation,
  costError,
  onOption,
  onCost,
  onRecommendation,
  disabled,
  children,
}: {
  prefix: string;
  copy: { label: string; help: string; cost: string; recommendation: string };
  option: QuoteDraft["framing_option"];
  cost: string;
  recommendation: string;
  costError?: string;
  onOption: (v: "self" | "other" | "unsure") => void;
  onCost: (v: string) => void;
  onRecommendation: (v: string) => void;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <Field label={copy.label} help={copy.help}>
        <Pills name={prefix} label={copy.label} value={option} options={C.options.who} onChange={onOption} disabled={disabled} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.cost} error={costError} htmlFor={`${prefix}-cost`}>
          <Money id={`${prefix}-cost`} value={cost} onChange={onCost} disabled={disabled} />
        </Field>
        <Field label={copy.recommendation} htmlFor={`${prefix}-rec`}>
          <input id={`${prefix}-rec`} className={inputClass} maxLength={QUOTE_LIMITS.recommendation} value={recommendation} onChange={(e) => onRecommendation(e.target.value)} disabled={disabled} />
        </Field>
      </div>
      {children}
    </fieldset>
  );
}
