/** Part one: shape, limits and validation. Shared by the form and the server. */

export const QUOTE_LIMITS = {
  questions: 800,
  approach: 600,
  altSize: 500,
  recommendation: 300,
  basedIn: 120,
  anythingElse: 1000,
  suggestion: 600,
} as const;

export const GST_RATE = 0.15;

export type Interested = "yes" | "yes_with_questions" | "no";
export type Who = "self" | "other" | "unsure";

/** What the form holds. Amounts stay as typed strings until saved. */
export interface QuoteDraft {
  interested: Interested | "";
  questions_text: string;
  deliver_by: "yes" | "date" | "";
  deliver_date: string;
  work_type: "new" | "existing" | "either" | "";
  existing_work_images: string[];
  approach_text: string;
  fee_1800x900: string;
  fee_1600x800: string;
  gst_inclusive: "" | "included" | "excluded";
  alt_size_note: string;
  framing_option: Who | "";
  framing_cost: string;
  framing_recommendation: string;
  install_option: Who | "";
  install_cost: string;
  install_recommendation: string;
  based_in: string;
  lead_time_weeks: string;
  anything_else: string;
}

export const EMPTY_QUOTE: QuoteDraft = {
  interested: "", questions_text: "", deliver_by: "", deliver_date: "", work_type: "",
  existing_work_images: [], approach_text: "", fee_1800x900: "", fee_1600x800: "",
  gst_inclusive: "", alt_size_note: "", framing_option: "", framing_cost: "",
  framing_recommendation: "", install_option: "", install_cost: "", install_recommendation: "",
  based_in: "", lead_time_weeks: "", anything_else: "",
};

/** "$1,800" or "1800.50" → 1800 / 1800.5. Empty → null. Anything else → NaN. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s,$]|nzd/gi, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

export type QuoteErrors = Partial<Record<keyof QuoteDraft, string>>;

/**
 * Errors for a submit. Codes, not words, so copy stays in artist-copy.ts:
 * required, fee1800, amount, gst, tooLong.
 */
export function validateQuote(q: QuoteDraft): QuoteErrors {
  const e: QuoteErrors = {};
  if (!q.interested) e.interested = "required";
  if (q.interested === "no") return e; // the rest is skipped

  if (!q.deliver_by) e.deliver_by = "required";
  if (q.deliver_by === "date" && !q.deliver_date) e.deliver_date = "required";
  if (!q.work_type) e.work_type = "required";
  if (!q.approach_text.trim()) e.approach_text = "required";
  else if (q.approach_text.length > QUOTE_LIMITS.approach) e.approach_text = "tooLong";

  const big = parseAmount(q.fee_1800x900);
  const small = parseAmount(q.fee_1600x800);
  if (big === null) e.fee_1800x900 = "fee1800";
  else if (Number.isNaN(big) || big <= 0) e.fee_1800x900 = "amount";
  if (small !== null && (Number.isNaN(small) || small <= 0)) e.fee_1600x800 = "amount";
  if ((big !== null || small !== null) && !q.gst_inclusive) e.gst_inclusive = "gst";

  for (const k of ["framing_cost", "install_cost"] as const) {
    const v = parseAmount(q[k]);
    if (v !== null && (Number.isNaN(v) || v < 0)) e[k] = "amount";
  }
  if (q.lead_time_weeks && !/^\d{1,3}$/.test(q.lead_time_weeks.trim())) e.lead_time_weeks = "amount";
  return e;
}

/** Converts a draft to the database row. Invalid numbers become null so a draft always saves. */
export function quoteToRow(q: QuoteDraft) {
  const num = (s: string) => {
    const v = parseAmount(s);
    return v === null || Number.isNaN(v) || v <= 0 ? null : v;
  };
  const cost = (s: string) => {
    const v = parseAmount(s);
    return v === null || Number.isNaN(v) || v < 0 ? null : v;
  };
  const text = (s: string, max: number) => s.trim().slice(0, max) || null;
  const weeks = Number.parseInt(q.lead_time_weeks, 10);
  return {
    interested: q.interested || null,
    questions_text: text(q.questions_text, QUOTE_LIMITS.questions),
    deliver_by: q.deliver_by || null,
    deliver_date: q.deliver_by === "date" && /^\d{4}-\d{2}-\d{2}$/.test(q.deliver_date) ? q.deliver_date : null,
    work_type: q.work_type || null,
    existing_work_images: q.work_type === "new" ? [] : q.existing_work_images.slice(0, 2),
    approach_text: text(q.approach_text, 700),
    fee_1800x900: num(q.fee_1800x900),
    fee_1600x800: num(q.fee_1600x800),
    gst_inclusive: q.gst_inclusive === "" ? null : q.gst_inclusive === "included",
    alt_size_note: text(q.alt_size_note, QUOTE_LIMITS.altSize),
    framing_option: q.framing_option || null,
    framing_cost: cost(q.framing_cost),
    framing_recommendation: text(q.framing_recommendation, QUOTE_LIMITS.recommendation),
    install_option: q.install_option || null,
    install_cost: cost(q.install_cost),
    install_recommendation: text(q.install_recommendation, QUOTE_LIMITS.recommendation),
    based_in: text(q.based_in, QUOTE_LIMITS.basedIn),
    lead_time_weeks: Number.isFinite(weeks) && weeks >= 0 && weeks <= 104 ? weeks : null,
    anything_else: text(q.anything_else, QUOTE_LIMITS.anythingElse),
  };
}

export type QuoteRow = ReturnType<typeof quoteToRow> & { status?: string; submitted_at?: string | null; updated_at?: string };

export function rowToQuote(r: Partial<QuoteRow> | null | undefined): QuoteDraft {
  if (!r) return { ...EMPTY_QUOTE };
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    interested: (r.interested as Interested) ?? "",
    questions_text: s(r.questions_text),
    deliver_by: (r.deliver_by as "yes" | "date") ?? "",
    deliver_date: s(r.deliver_date),
    work_type: (r.work_type as QuoteDraft["work_type"]) ?? "",
    existing_work_images: r.existing_work_images ?? [],
    approach_text: s(r.approach_text),
    fee_1800x900: s(r.fee_1800x900),
    fee_1600x800: s(r.fee_1600x800),
    gst_inclusive: r.gst_inclusive === null || r.gst_inclusive === undefined ? "" : r.gst_inclusive ? "included" : "excluded",
    alt_size_note: s(r.alt_size_note),
    framing_option: (r.framing_option as Who) ?? "",
    framing_cost: s(r.framing_cost),
    framing_recommendation: s(r.framing_recommendation),
    install_option: (r.install_option as Who) ?? "",
    install_cost: s(r.install_cost),
    install_recommendation: s(r.install_recommendation),
    based_in: s(r.based_in),
    lead_time_weeks: s(r.lead_time_weeks),
    anything_else: s(r.anything_else),
  };
}

/** A fee as excluding GST, for comparing like with like. */
export function exGst(amount: number | null, gstInclusive: boolean | null): number | null {
  if (amount === null) return null;
  return gstInclusive ? Math.round((amount / (1 + GST_RATE)) * 100) / 100 : amount;
}
