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
/** "These amounts are": plus GST, including GST, or not GST registered. */
export type GstTreatment = "plus" | "incl" | "none";

/** What the form holds. Amounts stay as typed strings until saved. */
export interface QuoteDraft {
  interested: Interested | "";
  questions_text: string;
  /** Q2: "Can you complete the work by early to mid January?" yes, or a date. */
  deliver_by: "yes" | "date" | "";
  deliver_date: string;
  /** Q3: "Have you made work at this scale before?" */
  scale_experience: "often" | "some" | "largest" | "";
  approach_text: string;
  fee_1800x900: string;
  fee_1600x800: string;
  /** Required once any amount is entered. */
  gst_treatment: GstTreatment | "";
  alt_size_note: string;
  framing_option: Who | "";
  framing_cost: string;
  framing_recommendation: string;
  install_option: Who | "";
  install_cost: string;
  install_recommendation: string;
  based_in: string;
  anything_else: string;
}

export const EMPTY_QUOTE: QuoteDraft = {
  interested: "", questions_text: "", deliver_by: "", deliver_date: "", scale_experience: "",
  approach_text: "", fee_1800x900: "", fee_1600x800: "", gst_treatment: "", alt_size_note: "",
  framing_option: "", framing_cost: "", framing_recommendation: "", install_option: "", install_cost: "",
  install_recommendation: "", based_in: "", anything_else: "",
};

/**
 * The "couple of questions" are kept as a numbered list ("1. ...\n2. ..."), which
 * reads well in the admin and the CSV. These convert to and from plain lines.
 */
export const MAX_QUESTIONS = 5;
export function questionLines(text: string): string[] {
  return text ? text.split("\n").map((l) => l.replace(/^\s*\d+\.\s?/, "")) : [""];
}
export function numberQuestions(lines: string[]): string {
  if (lines.length === 1 && !lines[0]) return "";
  return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
}

/** "$1,800" or "1800.50" → 1800 / 1800.5. Empty → null. Anything else → NaN. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s,$]|nzd/gi, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

/** Any amount typed anywhere in the quote, which is when GST needs an answer. */
export const hasAnyAmount = (q: QuoteDraft) =>
  [q.fee_1800x900, q.fee_1600x800, q.framing_cost, q.install_cost].some((s) => s.trim() !== "");

export type QuoteErrors = Partial<Record<keyof QuoteDraft, string>>;

/**
 * Errors for a submit. Codes, not words, so copy stays in artist-copy.ts:
 * required, fee1800, amount, gst, tooLong.
 */
export function validateQuote(q: QuoteDraft): QuoteErrors {
  const e: QuoteErrors = {};
  if (!q.interested) e.interested = "required";
  if (q.interested === "no") return e; // the rest is skipped
  if (q.interested === "yes_with_questions" && !questionLines(q.questions_text).some((l) => l.trim())) e.questions_text = "required";

  if (!q.deliver_by) e.deliver_by = "required";
  if (q.deliver_by === "date" && !q.deliver_date) e.deliver_date = "required";
  if (!q.scale_experience) e.scale_experience = "required";
  if (!q.approach_text.trim()) e.approach_text = "required";
  else if (q.approach_text.length > QUOTE_LIMITS.approach) e.approach_text = "tooLong";

  const big = parseAmount(q.fee_1800x900);
  const small = parseAmount(q.fee_1600x800);
  if (big === null) e.fee_1800x900 = "fee1800";
  else if (Number.isNaN(big) || big <= 0) e.fee_1800x900 = "amount";
  if (small !== null && (Number.isNaN(small) || small <= 0)) e.fee_1600x800 = "amount";
  if (hasAnyAmount(q) && !q.gst_treatment) e.gst_treatment = "gst";

  for (const k of ["framing_cost", "install_cost"] as const) {
    const v = parseAmount(q[k]);
    if (v !== null && (Number.isNaN(v) || v < 0)) e[k] = "amount";
  }
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
  const gst = hasAnyAmount(q) && q.gst_treatment ? q.gst_treatment : null;
  return {
    interested: q.interested || null,
    questions_text: text(q.questions_text, QUOTE_LIMITS.questions),
    deliver_by: q.deliver_by || null,
    deliver_date: q.deliver_by === "date" && /^\d{4}-\d{2}-\d{2}$/.test(q.deliver_date) ? q.deliver_date : null,
    scale_experience: q.scale_experience || null,
    approach_text: text(q.approach_text, 700),
    fee_1800x900: num(q.fee_1800x900),
    fee_1600x800: num(q.fee_1600x800),
    gst_treatment: gst,
    // Kept in step for anything reading the older column: true only when the amounts include GST.
    gst_inclusive: gst === null ? null : gst === "incl",
    alt_size_note: text(q.alt_size_note, QUOTE_LIMITS.altSize),
    framing_option: q.framing_option || null,
    framing_cost: cost(q.framing_cost),
    framing_recommendation: text(q.framing_recommendation, QUOTE_LIMITS.recommendation),
    install_option: q.install_option || null,
    install_cost: cost(q.install_cost),
    install_recommendation: text(q.install_recommendation, QUOTE_LIMITS.recommendation),
    based_in: text(q.based_in, QUOTE_LIMITS.basedIn),
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
    scale_experience: (r.scale_experience as QuoteDraft["scale_experience"]) ?? "",
    approach_text: s(r.approach_text),
    fee_1800x900: s(r.fee_1800x900),
    fee_1600x800: s(r.fee_1600x800),
    gst_treatment: (r.gst_treatment as GstTreatment) ?? "",
    alt_size_note: s(r.alt_size_note),
    framing_option: (r.framing_option as Who) ?? "",
    framing_cost: s(r.framing_cost),
    framing_recommendation: s(r.framing_recommendation),
    install_option: (r.install_option as Who) ?? "",
    install_cost: s(r.install_cost),
    install_recommendation: s(r.install_recommendation),
    based_in: s(r.based_in),
    anything_else: s(r.anything_else),
  };
}

/** A fee as excluding GST, for comparing like with like. Only "including GST" amounts change. */
export function exGst(amount: number | null, treatment: string | null): number | null {
  if (amount === null) return null;
  return treatment === "incl" ? Math.round((amount / (1 + GST_RATE)) * 100) / 100 : amount;
}

/** The GST answer on a saved row, falling back to the older yes/no column. */
export function gstOf(row: { gst_treatment?: string | null; gst_inclusive?: boolean | null } | null | undefined): GstTreatment | null {
  if (!row) return null;
  if (row.gst_treatment === "plus" || row.gst_treatment === "incl" || row.gst_treatment === "none") return row.gst_treatment;
  return row.gst_inclusive === true ? "incl" : row.gst_inclusive === false ? "plus" : null;
}

/** "Ready by" for the admin: January (the target), or the date they gave. */
export function readyBy(row: { deliver_by?: string | null; deliver_date?: string | null } | null | undefined): { label: string; sort: string } {
  if (!row?.deliver_by) return { label: "–", sort: "9" };
  if (row.deliver_by === "yes") return { label: "January", sort: "0" };
  const d = row.deliver_date ? new Date(`${row.deliver_date}T00:00:00Z`) : null;
  return d
    ? { label: d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), sort: row.deliver_date! }
    : { label: "Later, no date", sort: "8" };
}

/** How the admin and staff label the amounts. */
export const GST_LABEL: Record<GstTreatment, string> = {
  plus: "plus GST",
  incl: "incl. GST",
  none: "not GST registered",
};
