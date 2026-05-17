"use client";

import { useState } from "react";
import { Pencil, X, Check } from "lucide-react";
import { adminUpdateStudioUpdate } from "@/actions/admin-updates";

interface Props {
  updateId: string;
  initialTitle: string | null;
  initialTldr: string | null;
}

export function EditUpdateModal({ updateId, initialTitle, initialTldr }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [tldr, setTldr] = useState(initialTldr ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    const result = await adminUpdateStudioUpdate(updateId, {
      title: title.trim() || null,
      tldr: tldr.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setToast(`Error: ${result.error}`);
    } else {
      setToast("Saved");
      setOpen(false);
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
      >
        <Pencil className="w-3 h-3" />
        Edit share info
      </button>

      {toast && (
        <span className="text-xs text-emerald-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> {toast}
        </span>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-background border border-black p-6 space-y-5 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest">Edit Share Info</p>
              <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Title <span className="font-normal normal-case tracking-normal opacity-50">— shown on share card</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Artist Feature: Xinyi Zhang"
                maxLength={80}
                className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                TL;DR <span className="font-normal normal-case tracking-normal opacity-50">— subtitle on share card</span>
              </label>
              <textarea
                value={tldr}
                onChange={(e) => setTldr(e.target.value)}
                placeholder="e.g. Visual artist exploring materiality and absence"
                maxLength={160}
                rows={3}
                className="w-full text-sm border border-border px-3 py-2 resize-none bg-background focus:outline-none focus:border-black transition-colors"
              />
              <p className="text-[10px] text-muted-foreground text-right">{tldr.length} / 160</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
