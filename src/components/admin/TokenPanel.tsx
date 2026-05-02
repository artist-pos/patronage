"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  regenerateToken,
  updateOutreachStatus,
} from "@/app/admin/tokens/actions";
import type {
  ClaimTokenKind,
  ClaimTokenRow,
  OutreachStatus,
} from "@/types/database";

interface Props {
  rows: ClaimTokenRow[];
  uploadCounts: Record<string, number>;
  kindFilter: ClaimTokenKind | null;
  statusFilter: "claimed" | "pending" | null;
}

const KIND_LABELS: Record<ClaimTokenKind, string> = {
  opportunity: "Opportunity",
  provenance:  "Provenance",
  artist:      "Artist",
};

const OUTREACH_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "unattempted", label: "Unattempted" },
  { value: "emailed",     label: "Emailed" },
  { value: "phoned",      label: "Phoned" },
  { value: "unreachable", label: "Unreachable" },
];

export function TokenPanel({
  rows,
  uploadCounts,
  kindFilter,
  statusFilter,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortByUploads, setSortByUploads] = useState(false);

  const filteredRows = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    let out = rows;
    if (trimmed) {
      out = out.filter((r) =>
        [r.subject_label, r.subject_detail, r.contact_email]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(trimmed)),
      );
    }
    if (sortByUploads) {
      out = [...out].sort((a, b) => {
        const ac = uploadCounts[a.source_id] ?? 0;
        const bc = uploadCounts[b.source_id] ?? 0;
        return bc - ac;
      });
    }
    return out;
  }, [rows, search, sortByUploads, uploadCounts]);

  return (
    <div className="space-y-4">
      <Filters
        kindFilter={kindFilter}
        statusFilter={statusFilter}
        search={search}
        setSearch={setSearch}
        sortByUploads={sortByUploads}
        setSortByUploads={setSortByUploads}
      />

      <div className="overflow-x-auto border border-stone-100 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Uploads</th>
              <th className="text-left px-3 py-2">Outreach</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredRows.map((row) => (
              <Row
                key={`${row.token_kind}:${row.source_id}`}
                row={row}
                uploads={uploadCounts[row.source_id] ?? 0}
              />
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <p className="p-8 text-sm text-stone-500 text-center">No tokens match.</p>
        )}
      </div>
    </div>
  );
}

function Filters({
  kindFilter,
  statusFilter,
  search,
  setSearch,
  sortByUploads,
  setSortByUploads,
}: {
  kindFilter: ClaimTokenKind | null;
  statusFilter: "claimed" | "pending" | null;
  search: string;
  setSearch: (v: string) => void;
  sortByUploads: boolean;
  setSortByUploads: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterGroup label="Kind">
        <FilterLink href="/admin/tokens" active={kindFilter === null}>All</FilterLink>
        <FilterLink href="/admin/tokens?kind=opportunity" active={kindFilter === "opportunity"}>Opportunity</FilterLink>
        <FilterLink href="/admin/tokens?kind=provenance" active={kindFilter === "provenance"}>Provenance</FilterLink>
        <FilterLink href="/admin/tokens?kind=artist" active={kindFilter === "artist"}>Artist</FilterLink>
      </FilterGroup>

      <FilterGroup label="Status">
        <FilterLink href={`/admin/tokens${kindFilter ? `?kind=${kindFilter}` : ""}`} active={statusFilter === null}>All</FilterLink>
        <FilterLink href={`/admin/tokens?status=pending${kindFilter ? `&kind=${kindFilter}` : ""}`} active={statusFilter === "pending"}>Pending</FilterLink>
        <FilterLink href={`/admin/tokens?status=claimed${kindFilter ? `&kind=${kindFilter}` : ""}`} active={statusFilter === "claimed"}>Claimed</FilterLink>
      </FilterGroup>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search subject or email…"
        className="border border-stone-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-stone-400 ml-auto"
      />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={sortByUploads}
          onChange={(e) => setSortByUploads(e.target.checked)}
        />
        Sort by upload count
      </label>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {children}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
    >
      {children}
    </Link>
  );
}

function Row({ row, uploads }: { row: ClaimTokenRow; uploads: number }) {
  const [outreach, setOutreach] = useState<OutreachStatus | "">(row.outreach_status ?? "");
  const [notes, setNotes] = useState(row.outreach_notes ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveOutreach() {
    setError(null);
    startTransition(async () => {
      const result = await updateOutreachStatus(
        row.token_kind,
        row.source_id,
        (outreach || null) as OutreachStatus | null,
        notes,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    });
  }

  function handleRegenerate() {
    if (!confirm("Generate a new claim URL? The old link will stop working.")) return;
    setError(null);
    startTransition(async () => {
      const result = await regenerateToken(row.token_kind, row.source_id);
      if (result.error) setError(result.error);
      else if (result.claimToken) {
        // Cheap UX: reload so the new token surfaces in the row.
        window.location.reload();
      }
    });
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-3 text-xs uppercase tracking-wider text-stone-500">
        {KIND_LABELS[row.token_kind]}
      </td>
      <td className="px-3 py-3 max-w-[280px]">
        <div className="font-medium truncate">{row.subject_label}</div>
        {row.subject_detail && (
          <div className="text-xs text-muted-foreground truncate">{row.subject_detail}</div>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {row.contact_email ?? <span className="text-stone-400">—</span>}
      </td>
      <td className="px-3 py-3 text-sm">
        {row.token_kind === "artist" ? uploads : "—"}
      </td>
      <td className="px-3 py-3">
        {row.token_kind === "artist" ? (
          <div className="space-y-1">
            <select
              value={outreach}
              onChange={(e) => setOutreach(e.target.value as OutreachStatus | "")}
              className="w-full border border-stone-200 rounded px-2 py-1 text-xs"
            >
              <option value="">—</option>
              {OUTREACH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="w-full border border-stone-200 rounded px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleSaveOutreach}
              disabled={isPending}
              className="text-xs text-stone-600 hover:text-stone-900 underline"
            >
              {savedAt ? "Saved" : "Save"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-stone-400">N/A</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {row.is_claimed ? (
          <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Claimed
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded bg-stone-100 text-stone-700">
            Pending
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-xs space-y-1">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="text-stone-600 hover:text-red-700 underline"
        >
          Regenerate token
        </button>
        {error && <p className="text-red-600 text-[11px]">{error}</p>}
      </td>
    </tr>
  );
}
