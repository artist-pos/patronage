import { toDisciplineEnums } from "@/lib/signup-context";

/**
 * Reading an organisation's artist spreadsheet.
 *
 * Pure functions only, so the parsing and validation can be reasoned about
 * without a database. The server action layer handles deduplication against
 * real accounts and the sending.
 *
 * The rule throughout: never silently drop a row. An organisation handing over
 * its contact list needs to see exactly what will happen to every line before
 * anything is sent, including the lines we cannot use.
 */

export interface ParsedInviteRow {
  /** 1-based line number in the uploaded file, for pointing at problems. */
  line: number;
  email: string;
  fullName: string | null;
  /** Mapped onto our discipline enums; free text that matched nothing is dropped. */
  disciplines: string[];
  city: string | null;
  /** Why this row cannot be invited. Null means it can. */
  problem: string | null;
}

export interface ParsedInviteFile {
  rows: ParsedInviteRow[];
  /** Header labels we recognised, in the order they appeared. */
  columns: string[];
  /** Set when the file could not be read at all. */
  error: string | null;
}

/** Upper bound on one upload. Large enough for a regional body's whole list. */
export const MAX_INVITE_ROWS = 2000;

// ── Column matching ──────────────────────────────────────────────────────────
// Spreadsheets in the wild label these a dozen ways. Matching on substrings of
// a normalised header beats demanding an exact template, because an org that
// has to reshape its file to suit us is an org that does not bother.

type Field = "email" | "name" | "discipline" | "city";

const HEADER_PATTERNS: Array<[RegExp, Field]> = [
  [/e-?mail|address$/i, "email"],
  [/full.?name|artist|^name$|contact/i, "name"],
  [/discipline|medium|practice|art.?form|category/i, "discipline"],
  [/city|town|location|based|region|suburb/i, "city"],
];

function matchHeader(raw: string): Field | null {
  const h = raw.trim().toLowerCase();
  if (!h) return null;
  for (const [pattern, field] of HEADER_PATTERNS) {
    if (pattern.test(h)) return field;
  }
  return null;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Splits one CSV line, honouring double-quoted fields and escaped quotes.
 *
 * Hand-rolled rather than pulled from a package: the input is one column of
 * emails and three of short text, and a dependency for that is not worth the
 * bundle or the supply chain.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }

  out.push(field);
  return out.map((f) => f.trim());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Splits a discipline cell that may hold several, comma or slash separated. */
function splitDisciplines(cell: string): string[] {
  return cell
    .split(/[,/|]|\band\b|&/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Reads an uploaded CSV into rows, marking each one usable or not.
 *
 * Duplicate addresses inside the file itself are flagged here, since the
 * organisation should see that its own list repeats someone rather than have us
 * quietly collapse it.
 */
export function parseInviteCsv(text: string): ParsedInviteFile {
  const lines = text
    .replace(/^﻿/, "") // Excel writes a byte order mark
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], columns: [], error: "That file is empty." };
  }

  const header = splitCsvLine(lines[0]);
  const fields = header.map(matchHeader);

  const emailIndex = fields.indexOf("email");
  if (emailIndex === -1) {
    // The header row might be missing entirely — check whether line one is data.
    const looksLikeData = header.some((c) => EMAIL.test(c));
    return {
      rows: [],
      columns: [],
      error: looksLikeData
        ? "That file has no header row. Add one naming at least an email column."
        : "No email column found. Name one Email and re-upload.",
    };
  }

  const nameIndex = fields.indexOf("name");
  const disciplineIndex = fields.indexOf("discipline");
  const cityIndex = fields.indexOf("city");

  const columns = fields
    .map((f, i) => (f ? header[i].trim() : null))
    .filter((c): c is string => !!c);

  const rows: ParsedInviteRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    if (rows.length >= MAX_INVITE_ROWS) break;

    const cells = splitCsvLine(lines[i]);
    const rawEmail = (cells[emailIndex] ?? "").toLowerCase();
    const cell = (index: number) =>
      index >= 0 ? (cells[index] ?? "").trim() || null : null;

    let problem: string | null = null;
    if (!rawEmail) problem = "No email address";
    else if (!EMAIL.test(rawEmail)) problem = "Not a valid email address";
    else if (seen.has(rawEmail)) problem = "Repeated in this file";

    if (rawEmail && !problem) seen.add(rawEmail);

    const disciplineCell = cell(disciplineIndex);

    rows.push({
      line: i + 1,
      email: rawEmail,
      fullName: cell(nameIndex),
      disciplines: disciplineCell
        ? toDisciplineEnums(splitDisciplines(disciplineCell))
        : [],
      city: cell(cityIndex),
      problem,
    });
  }

  const truncated = lines.length - 1 > MAX_INVITE_ROWS;

  return {
    rows,
    columns,
    error: truncated
      ? `That file has more than ${MAX_INVITE_ROWS} rows. Only the first ${MAX_INVITE_ROWS} were read.`
      : null,
  };
}

// ── Preview shape ────────────────────────────────────────────────────────────

export type InviteOutcome =
  /** Will be emailed an invitation. */
  | "invite"
  /** Already has a Patronage account, so nothing is sent. */
  | "existing"
  /** This organisation has already invited this address. */
  | "already_invited"
  /** Cannot be used. `problem` says why. */
  | "invalid";

export interface PreviewRow extends ParsedInviteRow {
  outcome: InviteOutcome;
  /** Username of the matched account, so the org can see who it found. */
  existingUsername?: string;
}

export interface InvitePreview {
  rows: PreviewRow[];
  counts: Record<InviteOutcome, number>;
  total: number;
  columns: string[];
  /** File-level problem, e.g. a missing email column. */
  error: string | null;
}

export function summarise(rows: PreviewRow[]): Record<InviteOutcome, number> {
  const counts: Record<InviteOutcome, number> = {
    invite: 0,
    existing: 0,
    already_invited: 0,
    invalid: 0,
  };
  for (const r of rows) counts[r.outcome]++;
  return counts;
}
