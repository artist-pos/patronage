"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ORG_CATEGORIES } from "@/lib/org-categories";
import { createClient } from "@/lib/supabase/client";
import { createShadowProfile, generateClaimToken } from "@/app/admin/claim-tokens/actions";

interface Props {
  initialName: string;
  onCreated: (profile: { id: string; username: string; name: string }) => void;
  onClose: () => void;
}

/**
 * Admin → Claim tokens → "Create shadow profile", opened from a listing's
 * organiser field. Same actions and fields: an unclaimed organisation account
 * (type, region, bio), plus a claim token when a contact is known. Nothing is
 * emailed; send the claim from Claim tokens when ready.
 */
export function NewOrganisationModal({ initialName, onCreated, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [orgCategory, setOrgCategory] = useState("");
  const [regionId, setRegionId] = useState("");
  const [bio, setBio] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    createClient()
      .from("regions")
      .select("id, name")
      .order("sort_order", { ascending: true })
      .then(({ data }) => setRegions(data ?? []));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function create() {
    const clean = name.trim();
    if (!clean) return setError("Name is required.");
    setError(null);
    startTransition(async () => {
      const res = await createShadowProfile({
        name: clean,
        entityType: "partner",
        orgCategory: orgCategory || null,
        regionId: regionId || null,
        bio: bio || null,
      });
      if (res.error || !res.profileId || !res.username) return setError(res.error ?? "Failed to create profile.");

      // A claim token only when there's someone to send it to. Not sent here.
      if (recipientEmail.trim()) {
        const token = await generateClaimToken({
          entityType: "partner",
          entityId: res.profileId,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || clean,
        });
        if (token.error) console.error("[new organisation] claim token:", token.error);
      }
      onCreated({ id: res.profileId, username: res.username, name: clean });
    });
  }

  const inputCls =
    "w-full text-xs border border-border bg-transparent px-2.5 py-1.5 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300";
  const labelCls = "text-xs font-medium uppercase tracking-widest text-stone-400";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-md border border-black bg-background shadow-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="New organisation"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-sm font-semibold">New organisation (shadow profile)</p>
            <button type="button" onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className={labelCls}>Organisation name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={labelCls}>Type</label>
                <select value={orgCategory} onChange={(e) => setOrgCategory(e.target.value)} className={inputCls}>
                  <option value="">Not set</option>
                  {ORG_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Region</label>
                <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={inputCls}>
                  <option value="">Not set</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="Optional"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Claim contact</label>
                <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Contact email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="jane@org.nz"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates an unclaimed profile and links this listing to it. With a contact email, a claim token is made too;
              nothing is sent until you send it from Claim tokens.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-border py-2.5 text-xs font-medium transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={pending || !name.trim()}
                className="flex-1 bg-black py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {pending ? "Creating…" : "Create and link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
