"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";
import { editUpdate } from "@/actions/updates";
import type { ContentTypeEnum } from "@/types/database";

interface Props {
  updateId: string;
  contentType: ContentTypeEnum;
  initialTitle: string | null;
  initialTldr: string | null;
  initialCaption: string | null;
  initialTextContent: string | null;
}

export function EditUpdateModal({
  updateId,
  contentType,
  initialTitle,
  initialTldr,
  initialCaption,
  initialTextContent,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [tldr, setTldr] = useState(initialTldr ?? "");
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [textContent, setTextContent] = useState(initialTextContent ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isText = contentType === "text";

  async function handleSave() {
    setSaving(true);
    const result = await editUpdate(updateId, {
      title: title.trim() || null,
      tldr: tldr.trim() || null,
      ...(isText
        ? { text_content: textContent.trim() || null }
        : { caption: caption.trim() || null }),
    });
    setSaving(false);
    if (result.error) {
      setToast(`Error: ${result.error}`);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setToast("Saved");
    setOpen(false);
    router.refresh();
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
      >
        <Pencil className="w-3 h-3" />
        Edit
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
            className="w-full max-w-md bg-background border border-black p-6 space-y-5 mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest">Edit Update</p>
              <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Caption (media posts) / Written content (text posts) */}
            {isText ? (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Written content
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Your poem, prose, or notes…"
                  rows={8}
                  className="w-full text-sm border border-border px-3 py-2 resize-none bg-background focus:outline-none focus:border-black transition-colors"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption…"
                  rows={3}
                  className="w-full text-sm border border-border px-3 py-2 resize-none bg-background focus:outline-none focus:border-black transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Title <span className="font-normal normal-case tracking-normal opacity-50">— heading in thread &amp; on share card</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. First firing of the season"
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
                placeholder="e.g. Glaze tests for the new series"
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
