"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExhibitionEntry } from "@/types/database";

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";
const LABEL = "text-xs font-semibold uppercase tracking-widest";

function blank(): ExhibitionEntry {
  return { type: "Solo", title: "", venue: "", location: "", year: new Date().getFullYear() };
}

interface Props {
  profileId: string;
  initial: ExhibitionEntry[];
}

export function ExhibitionEditor({ profileId, initial }: Props) {
  const [entries, setEntries] = useState<ExhibitionEntry[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  function upd(idx: number, field: keyof ExhibitionEntry, value: string | number) {
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
      .update({ exhibition_history: entries })
      .eq("id", profileId);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div key={idx} className="border border-black p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Type</Label>
              <select
                value={entry.type}
                onChange={(e) => upd(idx, "type", e.target.value)}
                className={FIELD}
              >
                <option value="Solo">Solo</option>
                <option value="Group">Group</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Year</Label>
              <Input
                type="number"
                min={1900}
                max={2099}
                value={entry.year}
                onChange={(e) => upd(idx, "year", parseInt(e.target.value) || new Date().getFullYear())}
                className={FIELD}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className={LABEL}>Exhibition Title</Label>
              <Input
                value={entry.title}
                placeholder="e.g. Here and Now"
                onChange={(e) => upd(idx, "title", e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Venue</Label>
              <Input
                value={entry.venue}
                placeholder="e.g. Te Uru Waitākere Contemporary Gallery"
                onChange={(e) => upd(idx, "venue", e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Location</Label>
              <Input
                value={entry.location}
                placeholder="e.g. Auckland, NZ"
                onChange={(e) => upd(idx, "location", e.target.value)}
                className={FIELD}
              />
            </div>
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
          + Add Exhibition
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
