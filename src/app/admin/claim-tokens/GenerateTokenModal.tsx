"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { X, Plus, Copy, Check, Search } from "lucide-react";
import type { ClaimEntityType } from "@/types/database";
import { ORG_CATEGORIES } from "@/lib/org-categories";
import type { CatalogOrgStatus, RegionCoverage } from "@/lib/region-coverage";
import { generateClaimToken, createShadowProfile, searchProfiles } from "./actions";

const SITE_URL = typeof window !== "undefined" ? window.location.origin : "https://patronage.nz";

interface Props {
  onClose: () => void;
  onGenerated: () => void;
  coverage: RegionCoverage[];
  catalog: CatalogOrgStatus[];
}

export function GenerateTokenModal({ onClose, onGenerated, coverage, catalog }: Props) {
  const [isPending, startTransition] = useTransition();
  const [entityType, setEntityType] = useState<ClaimEntityType>("partner");
  const [mode, setMode] = useState<"search" | "create">("search");

  // Search existing profile
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string | null; username: string }[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfileName, setSelectedProfileName] = useState<string>("");
  const [searching, setSearching] = useState(false);

  // Create shadow profile
  const [shadowName, setShadowName] = useState("");
  const [orgCategory, setOrgCategory] = useState<string>("regional_arts_org");
  const [regionId, setRegionId] = useState<string>("");
  const [shadowBio, setShadowBio] = useState<string>("");

  const selectedRegion = coverage.find((r) => r.regionId === regionId) ?? null;

  // Token details
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");

  // Result
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQuery.trim() || mode !== "search") {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchProfiles(searchQuery, entityType);
      setSearchResults(results);
      setSearching(false);
    }, 300);
  }, [searchQuery, entityType, mode]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleGenerate() {
    setError(null);
    startTransition(async () => {
      let entityId = selectedProfileId;

      if (mode === "create") {
        if (!shadowName.trim()) { setError("Name is required."); return; }
        const res = await createShadowProfile({
          name: shadowName,
          entityType,
          orgCategory: entityType === "partner" ? orgCategory || null : null,
          regionId: entityType === "partner" ? regionId || null : null,
          bio: entityType === "partner" ? shadowBio || null : null,
        });
        if (res.error || !res.profileId) { setError(res.error ?? "Failed to create profile."); return; }
        entityId = res.profileId;
        if (!recipientName) setRecipientName(shadowName);
      }

      if (!entityId) { setError("Select or create a profile."); return; }

      const res = await generateClaimToken({
        entityType,
        entityId,
        recipientEmail: recipientEmail || undefined,
        recipientName: recipientName || undefined,
        notes: notes || undefined,
      });

      if (res.error || !res.token) { setError(res.error ?? "Failed to generate token."); return; }
      setGeneratedUrl(`${SITE_URL}/claim/${res.token}`);
      onGenerated();
    });
  }

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const inputCls = "w-full text-xs border border-border bg-transparent px-2.5 py-1.5 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300";
  const labelCls = "text-[10px] font-medium uppercase tracking-widest text-stone-400";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-black w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold">Generate Claim Token</p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {generatedUrl ? (
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium">Token generated!</p>
              <p className="text-xs text-muted-foreground">Share this link with the recipient:</p>
              <div className="flex items-center gap-2 border border-border p-2 bg-stone-50">
                <span className="text-xs font-mono break-all flex-1">{generatedUrl}</span>
                <button onClick={handleCopy} className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setGeneratedUrl(null); setSelectedProfileId(null); setSelectedProfileName(""); setSearchQuery(""); setShadowName(""); setShadowBio(""); setRegionId(""); setRecipientEmail(""); setRecipientName(""); setNotes(""); }}
                  className="flex-1 text-xs font-medium py-2 border border-border hover:bg-stone-50 transition-colors"
                >
                  Generate another
                </button>
                <button onClick={onClose} className="flex-1 text-xs font-medium py-2 bg-black text-white hover:opacity-80 transition-opacity">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Entity type */}
              <div className="space-y-1.5">
                <label className={labelCls}>Profile Type</label>
                <div className="flex border border-border">
                  {(["partner", "artist"] as ClaimEntityType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setEntityType(t); setSelectedProfileId(null); setSearchQuery(""); setSearchResults([]); }}
                      className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${entityType === t ? "bg-black text-white" : "hover:bg-stone-50"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile selection mode */}
              <div className="space-y-1.5">
                <label className={labelCls}>Profile</label>
                <div className="flex border border-border text-xs mb-2">
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className={`flex-1 py-1.5 font-medium transition-colors ${mode === "search" ? "bg-black text-white" : "hover:bg-stone-50"}`}
                  >
                    Search existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("create")}
                    className={`flex-1 py-1.5 font-medium transition-colors ${mode === "create" ? "bg-black text-white" : "hover:bg-stone-50"}`}
                  >
                    Create shadow profile
                  </button>
                </div>

                {mode === "search" ? (
                  <div className="space-y-2">
                    {selectedProfileId ? (
                      <div className="flex items-center gap-2 border border-border px-3 py-2 bg-stone-50">
                        <span className="text-xs flex-1">{selectedProfileName}</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedProfileId(null); setSelectedProfileName(""); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${entityType} profiles…`}
                            className={`${inputCls} pl-7`}
                          />
                        </div>
                        {searching && <p className="text-xs text-muted-foreground px-1">Searching…</p>}
                        {searchResults.length > 0 && (
                          <div className="border border-border divide-y divide-border max-h-40 overflow-y-auto">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProfileId(p.id);
                                  setSelectedProfileName(p.full_name ?? p.username);
                                  setSearchQuery("");
                                  setSearchResults([]);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 transition-colors flex items-center justify-between"
                              >
                                <span>{p.full_name ?? p.username}</span>
                                <span className="text-muted-foreground font-mono">@{p.username}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={shadowName}
                      onChange={(e) => { setShadowName(e.target.value); if (!recipientName) setRecipientName(e.target.value); }}
                      placeholder={entityType === "partner" ? "Organisation name" : "Artist name"}
                      className={inputCls}
                    />
                    {entityType === "partner" && (
                      <select
                        value=""
                        onChange={(e) => {
                          const o = catalog.find((c) => c.key === e.target.value);
                          if (!o) return;
                          setShadowName(o.name);
                          if (!recipientName) setRecipientName(o.name);
                          setShadowBio(o.bio);
                          setOrgCategory("regional_arts_org");
                          setRegionId(o.regionId ?? "");
                        }}
                        className={inputCls}
                      >
                        <option value="">Fill from a known regional arts organisation…</option>
                        {catalog.map((c) => (
                          <option key={c.key} value={c.key} disabled={!!c.profile}>
                            {c.name}{c.profile ? " (already exists)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {entityType === "partner" && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <label className={labelCls}>Type</label>
                          <select value={orgCategory} onChange={(e) => setOrgCategory(e.target.value)} className={inputCls}>
                            <option value="">Not set</option>
                            {ORG_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className={labelCls}>Region</label>
                          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={inputCls}>
                            <option value="">Not set</option>
                            {coverage.map((r) => (
                              <option key={r.regionId} value={r.regionId}>
                                {r.name} ({r.artistCount})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {entityType === "partner" && orgCategory === "regional_arts_org" && selectedRegion && (
                      <p className="text-[10px] text-muted-foreground">
                        {selectedRegion.artistCount} artist{selectedRegion.artistCount === 1 ? " is" : "s are"} already in {selectedRegion.name} and will
                        show on this organisation&apos;s region page.
                        {selectedRegion.org && (
                          <> {selectedRegion.org.name} already anchors this region — a second organisation will not replace it.</>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">A shadow profile will be created and activated when claimed.</p>
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className={labelCls}>Recipient Name</label>
                  <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Recipient Email</label>
                  <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="jane@org.nz" className={inputCls} />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className={labelCls}>Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" className={inputCls} />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 text-xs font-medium py-2.5 border border-border hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isPending || (mode === "search" && !selectedProfileId) || (mode === "create" && !shadowName.trim())}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isPending ? "Generating…" : "Generate Token"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
