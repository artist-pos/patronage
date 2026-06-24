"use client";

import { Plus, X } from "lucide-react";
import type { ApplicationLink } from "@/types/database";

interface Props {
  links: ApplicationLink[];
  onChange: (links: ApplicationLink[]) => void;
}

const FIELD =
  "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";

// Sensible default for the first/standard link so people know what to put.
// It's pre-filled into the value (not just a placeholder) but stays editable.
const DEFAULT_FIRST_LABEL = "Apply on Official Site";

/**
 * Repeatable list of labelled application links. Each row becomes its own
 * button on the public listing. Always renders at least one (blank) row so a
 * single link works with no extra clicks. Pure controlled component — the
 * parent owns persistence and keeps the legacy `url` in sync with the first row.
 */
export function ApplicationLinksEditor({ links, onChange }: Props) {
  const rows = links.length > 0 ? links : [{ label: DEFAULT_FIRST_LABEL, url: "" }];

  function update(index: number, patch: Partial<ApplicationLink>) {
    onChange(rows.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
  }

  function add() {
    onChange([...rows, { label: "", url: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {rows.map((link, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <input
              type="text"
              value={link.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Link label — e.g. Franklin Arts Centre"
              className={`${FIELD} sm:w-2/5 shrink-0`}
            />
            <input
              type="url"
              value={link.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://…"
              className={`${FIELD} flex-1 min-w-0`}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="border border-black/40 p-2 text-stone-400 hover:text-foreground hover:border-black transition-colors shrink-0"
                aria-label="Remove link"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
      >
        <Plus className="w-3 h-3" /> Add link
      </button>
      <p className="text-xs text-muted-foreground">
        Add one button per application route. The label is shown on the button.
      </p>
    </div>
  );
}
