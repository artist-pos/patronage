"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EducationEntry } from "@/types/database";

const FIELD = "w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black";
const LABEL = "text-xs font-semibold uppercase tracking-widest";

function blank(): EducationEntry {
  return { level: "Tertiary", institution: "", course: "", start_year: null, end_year: null };
}

interface Props {
  profileId: string;
  initial: EducationEntry[];
}

/** Where someone has studied, for the CV tab. Same shape as the exhibition editor. */
export function EducationEditor({ profileId, initial }: Props) {
  const [entries, setEntries] = useState<EducationEntry[]>(initial);
  const nextKey = useRef(initial.length);
  const [keys, setKeys] = useState<number[]>(() => initial.map((_, i) => i));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function upd<K extends keyof EducationEntry>(idx: number, field: K, value: EducationEntry[K]) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
    setSaved(false);
  }

  function remove(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setKeys((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function add() {
    setEntries((p) => [...p, blank()]);
    setKeys((p) => [...p, nextKey.current++]);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const clean = entries.filter((e) => e.institution.trim());
    const { error: err } = await supabase.from("profiles").update({ education: clean }).eq("id", profileId);
    setSaving(false);
    if (err) {
      setError("Couldn’t save that. Try again.");
      return;
    }
    setSaved(true);
  }

  const yearValue = (v: number | null) => (v === null ? "" : String(v));
  const parseYear = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div key={keys[idx]} className="border border-black p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Level</Label>
              <select
                value={entry.level}
                onChange={(e) => upd(idx, "level", e.target.value as EducationEntry["level"])}
                className={FIELD}
              >
                <option value="Secondary">Secondary school</option>
                <option value="Tertiary">University or art school</option>
                <option value="Short course">Short course</option>
              </select>
            </div>
            <div className="sm:col-span-3 space-y-1.5">
              <Label className={LABEL}>School or institution</Label>
              <Input
                value={entry.institution}
                placeholder="e.g. Elam School of Fine Arts"
                onChange={(e) => upd(idx, "institution", e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className={LABEL}>Course or subject</Label>
              <Input
                value={entry.course}
                placeholder="e.g. Bachelor of Fine Arts, Painting"
                onChange={(e) => upd(idx, "course", e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>From</Label>
              <Input
                type="number"
                min={1900}
                max={2099}
                value={yearValue(entry.start_year)}
                onChange={(e) => upd(idx, "start_year", parseYear(e.target.value))}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>To</Label>
              <Input
                type="number"
                min={1900}
                max={2099}
                value={yearValue(entry.end_year)}
                placeholder="Still studying"
                onChange={(e) => upd(idx, "end_year", parseYear(e.target.value))}
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

      <div className="sticky bottom-0 z-10 border-t border-black bg-background py-3 flex items-center gap-4">
        <button
          type="button"
          onClick={add}
          className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          + Add education
        </button>
        {entries.length > 0 && (
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </Button>
        )}
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
