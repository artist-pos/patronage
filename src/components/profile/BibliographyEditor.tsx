"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BibliographyEntry } from "@/types/database";

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";
const LABEL = "text-xs font-semibold uppercase tracking-widest";

function blank(): BibliographyEntry {
  return { type: "Review", author: "", title: "", publication: "", date: "", link: "" };
}

interface Props {
  profileId: string;
  initial: BibliographyEntry[];
}

export function BibliographyEditor({ profileId, initial }: Props) {
  const [entries, setEntries] = useState<BibliographyEntry[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  function upd(idx: number, field: keyof BibliographyEntry, value: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e))
    );
    setSaved(false);
  }

  function remove(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ press_bibliography: entries })
      .eq("id", profileId);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div key={idx} className="border border-black p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Type</Label>
              <select
                value={entry.type}
                onChange={(e) => upd(idx, "type", e.target.value)}
                className={FIELD}
              >
                <option value="Review">Review</option>
                <option value="Interview">Interview</option>
                <option value="Feature">Feature</option>
                <option value="Essay">Essay</option>
                <option value="Article">Article</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Author</Label>
              <Input
                value={entry.author}
                placeholder="e.g. Jane Smith"
                onChange={(e) => upd(idx, "author", e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Date</Label>
              <Input
                value={entry.date}
                placeholder="e.g. March 2024"
                onChange={(e) => upd(idx, "date", e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Article Title</Label>
              <Input
                value={entry.title}
                placeholder="e.g. The Space Between Things"
                onChange={(e) => upd(idx, "title", e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Publication</Label>
              <Input
                value={entry.publication}
                placeholder="e.g. Art New Zealand"
                onChange={(e) => upd(idx, "publication", e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL}>Link (optional)</Label>
            <Input
              value={entry.link}
              type="url"
              placeholder="https://..."
              onChange={(e) => upd(idx, "link", e.target.value)}
              className={FIELD}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={() => { setEntries((p) => [...p, blank()]); setSaved(false); }}
          className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          + Add Entry
        </button>
        {entries.length > 0 && (
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
