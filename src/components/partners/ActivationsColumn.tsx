"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, X, Check, ChevronUp, ChevronDown, EyeOff, Eye, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitActivationEnquiry } from "@/app/partners/actions";
import { updateActivationType } from "@/app/partners/actions";
import type { ActivationType } from "@/app/partners/page";

const HOW_IT_WORKS = [
  "You brief us on the surface, timeline, and budget",
  "We run a targeted open call to our artist network",
  "You select artists through a shortlisting dashboard",
  "We manage production, printing, and installation",
  "QR codes on every surface link to artist profiles",
  "You receive a full impact report — scans, engagement, reach",
] as const;

const INTEREST_OPTIONS = [
  "Hoardings", "Billboards", "Truck curtains", "Packaging", "Public art", "Other",
] as const;

interface Props {
  activationTypes: ActivationType[];
  isAdmin: boolean;
  /** When true, the section header (h2 + description) is suppressed — rendered by the parent grid instead */
  hideHeader?: boolean;
}

export function ActivationsColumn({ activationTypes: initial, isAdmin, hideHeader = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<ActivationType[]>(initial);

  // Enquiry form
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  // Admin editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ActivationType>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function toggleInterest(v: string) {
    setInterests(prev => {
      const n = new Set(prev);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });
  }

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  }

  async function handleEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    const result = await submitActivationEnquiry({
      name, organisation: org, email, interests: [...interests], message,
    });
    setSending(false);
    if (result.error) { setSendError(result.error); return; }
    setSent(true);
  }

  // ── Admin helpers ─────────────────────────────────────────────────────────

  function startEdit(card: ActivationType) {
    setEditingId(card.id);
    setEditDraft({ title: card.title, description: card.description, image_url: card.image_url });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const result = await updateActivationType(id, {
      title: editDraft.title,
      description: editDraft.description,
      image_url: editDraft.image_url ?? null,
    });
    setSaving(false);
    if (result.error) { setSaveError(result.error); return; }
    setCards(prev =>
      prev.map(c => c.id === id ? { ...c, ...editDraft } as ActivationType : c)
    );
    setEditingId(null);
    setEditDraft({});
  }

  async function toggleVisible(card: ActivationType) {
    const newVal = !card.is_active;
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_active: newVal } : c));
    await updateActivationType(card.id, { is_active: newVal });
  }

  async function moveCard(id: string, dir: "up" | "down") {
    const idx = cards.findIndex(c => c.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cards.length) return;

    const newCards = [...cards];
    [newCards[idx], newCards[swapIdx]] = [newCards[swapIdx], newCards[idx]];

    // Update sort_order values
    const updated = newCards.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setCards(updated);

    // Persist both affected rows
    await Promise.all([
      updateActivationType(updated[idx].id, { sort_order: updated[idx].sort_order }),
      updateActivationType(updated[swapIdx].id, { sort_order: updated[swapIdx].sort_order }),
    ]);
  }

  async function handleImgUpload(file: File, id: string) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${id}.${ext}`;
    const { error } = await supabase.storage
      .from("activation-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return;
    const { data } = supabase.storage.from("activation-images").getPublicUrl(path);
    setEditDraft(prev => ({ ...prev, image_url: data.publicUrl }));
  }

  const visibleCards = isAdmin ? cards : cards.filter(c => c.is_active);

  return (
    <div className="space-y-12">
      {/* Section header — hidden when parent renders it at the grid level for alignment */}
      {!hideHeader && (
        <div className="space-y-2 border-b border-black pb-6">
          <h2 className="text-xl font-semibold tracking-tight">Activations</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Partner with us to commission artists for surfaces you already own — hoardings,
            vehicles, packaging, screens — and turn existing budgets into public art with full
            impact reporting.
          </p>
        </div>
      )}

      {/* Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What we do
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:border-black hover:text-foreground transition-colors text-xs"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="w-7 h-7 border border-border flex items-center justify-center text-muted-foreground hover:border-black hover:text-foreground transition-colors text-xs"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {visibleCards.map((card, idx) => (
            <div
              key={card.id}
              className={`relative shrink-0 w-56 border p-4 space-y-2 group ${
                card.is_active ? "border-border" : "border-dashed border-border opacity-50"
              }`}
              style={{ scrollSnapAlign: "start" }}
            >
              {editingId === card.id ? (
                /* ── Inline edit mode ── */
                <div className="space-y-2">
                  {/* Image */}
                  <div
                    className="w-full h-32 bg-stone-100 cursor-pointer relative overflow-hidden"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    {editDraft.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editDraft.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">
                        Click to upload image
                      </div>
                    )}
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImgUpload(f, card.id);
                      }}
                    />
                  </div>

                  <input
                    type="text"
                    value={editDraft.title ?? ""}
                    onChange={e => setEditDraft(p => ({ ...p, title: e.target.value }))}
                    placeholder="Title"
                    className="w-full border border-border px-2 py-1 text-xs font-semibold focus:outline-none focus:border-black"
                  />
                  <textarea
                    value={editDraft.description ?? ""}
                    onChange={e => setEditDraft(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description"
                    rows={3}
                    className="w-full border border-border px-2 py-1 text-[11px] leading-relaxed focus:outline-none focus:border-black resize-none"
                  />

                  {saveError && <p className="text-[10px] text-destructive">{saveError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => saveEdit(card.id)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-black text-white py-1 hover:bg-black/80 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] border border-border py-1 hover:border-black transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display mode ── */
                <>
                  {/* Image */}
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_url} alt={card.title} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-stone-100" />
                  )}

                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{card.description}</p>

                  {/* Admin controls — appear on hover */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white border border-border shadow-sm p-1">
                      <button
                        type="button"
                        onClick={() => startEdit(card)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCard(card.id, "up")}
                        disabled={idx === 0}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="Move left"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCard(card.id, "down")}
                        disabled={idx === visibleCards.length - 1}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        title="Move right"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisible(card)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title={card.is_active ? "Hide" : "Show"}
                      >
                        {card.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <div className="space-y-0">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="flex gap-4 border-t border-border py-3.5">
              <span className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0 w-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Enquiry form */}
      <div className="border border-border">
        {/* Mobile-only collapse toggle */}
        <button
          type="button"
          onClick={() => setEnquiryOpen(v => !v)}
          className="lg:hidden w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-stone-50 transition-colors"
          aria-expanded={enquiryOpen}
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold">Get in touch</p>
            <p className="text-xs text-muted-foreground">
              Tell us about your project. We&apos;ll be in touch within 48 hours.
            </p>
          </div>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${enquiryOpen ? "rotate-90" : ""}`}
          />
        </button>

        {/* Desktop: header always visible at top of form */}
        <div className="hidden lg:block px-6 pt-6 pb-2 space-y-1">
          <p className="text-sm font-semibold">Get in touch</p>
          <p className="text-xs text-muted-foreground">
            Tell us about your project. We&apos;ll be in touch within 48 hours.
          </p>
        </div>

        <div className={`${enquiryOpen ? "block" : "hidden"} lg:block px-6 pb-6 pt-3 lg:pt-3 space-y-5`}>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Thanks — we&apos;ll be in touch. Usually within 48 hours.
          </p>
        ) : (
          <form onSubmit={handleEnquiry} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Organisation</label>
                <input
                  type="text"
                  value={org}
                  onChange={e => setOrg(e.target.value)}
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Interested in</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleInterest(v)}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      interests.has(v)
                        ? "bg-black text-white border-black"
                        : "border-border hover:border-black"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Tell us about your project *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={4}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
              />
            </div>

            {sendError && <p className="text-xs text-destructive">{sendError}</p>}

            <button
              type="submit"
              disabled={sending}
              className="text-sm border border-black bg-black text-white px-5 py-2.5 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send enquiry →"}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
