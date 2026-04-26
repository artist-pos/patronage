"use client";

import { useState, useRef } from "react";
import { saveProvenanceSettings } from "@/app/dashboard/provenance-actions";
import { SignatureInput } from "./SignatureInput";
import { CertificatePreview } from "./CertificatePreview";
import { FONT_PAIRS, type ProvenanceFontPair, type ProvenanceOrientation } from "@/lib/provenance-theme";

interface Props {
  userId: string;
  initialLogoUrl: string | null;
  initialSignaturePath: string | null;
  initialSignatureSignedUrl: string | null;
  initialTheme: "minimal" | "editorial" | "gallery";
  initialPrimaryColor: string;
  initialAccentColor: string;
  initialFontPair: ProvenanceFontPair;
  initialOrientation: ProvenanceOrientation;
}

const THEMES: { value: "minimal" | "editorial" | "gallery"; label: string; description: string }[] = [
  { value: "minimal",   label: "Minimal",   description: "Clean, lots of whitespace, sans-serif typography" },
  { value: "editorial", label: "Editorial", description: "Slightly warmer, serif headings, horizontal rules" },
  { value: "gallery",   label: "Gallery",   description: "Formal layout with heavier typographic hierarchy" },
];

function ColorField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const isValid = HEX_RE.test(value);
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValid ? value : "#000000"}
          onChange={e => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-stone-200 cursor-pointer bg-transparent p-0"
          aria-label={`${label} colour picker`}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          className={`flex-1 h-10 px-3 rounded-lg border text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-stone-900 ${
            isValid ? "border-stone-200" : "border-red-300"
          }`}
          placeholder="#000000"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {presets.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Use ${p}`}
            className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
              value.toLowerCase() === p.toLowerCase() ? "ring-2 ring-stone-900 ring-offset-1" : "border-stone-200"
            }`}
            style={{ background: p }}
          />
        ))}
      </div>
    </div>
  );
}

function LogoUploader({
  currentUrl,
  onUpload,
}: {
  currentUrl: string | null;
  onUpload: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) { setUploadError("File must be under 2 MB"); return; }
    setUploadError(null);
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/provenance/upload-logo", { method: "POST", body });
    const json = await res.json();
    if (!res.ok || json.error) { setUploadError(json.error ?? "Upload failed"); setUploading(false); return; }
    setPreviewUrl(json.publicUrl);
    onUpload(json.publicUrl);
    setUploading(false);
  }

  return (
    <div>
      {previewUrl ? (
        <div className="flex items-start gap-4">
          <div className="w-32 h-16 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden">
            <img src={previewUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-stone-600 disabled:opacity-50">
              Replace
            </button>
            <button type="button" onClick={() => { setPreviewUrl(null); onUpload(null); }}
              className="text-xs text-stone-400 hover:text-red-600 transition-colors">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:border-stone-300 transition-colors cursor-pointer"
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <p className="text-sm text-stone-400">Uploading…</p> : (
            <>
              <p className="text-sm text-stone-500">Drag & drop or click to upload</p>
              <p className="text-xs text-stone-400 mt-1">PNG, JPG or SVG · max 2 MB</p>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        className="hidden" />
      {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
    </div>
  );
}

export function ProvenanceSettingsForm({
  userId,
  initialLogoUrl,
  initialSignaturePath,
  initialSignatureSignedUrl,
  initialTheme,
  initialPrimaryColor,
  initialAccentColor,
  initialFontPair,
  initialOrientation,
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [signaturePath, setSignaturePath] = useState<string | null>(initialSignaturePath);
  const [signatureSignedUrl, setSignatureSignedUrl] = useState<string | null>(initialSignatureSignedUrl);
  const [theme, setTheme] = useState<"minimal" | "editorial" | "gallery">(initialTheme);
  const [primaryColor, setPrimaryColor] = useState<string>(initialPrimaryColor);
  const [accentColor, setAccentColor] = useState<string>(initialAccentColor);
  const [fontPair, setFontPair] = useState<ProvenanceFontPair>(initialFontPair);
  const [orientation, setOrientation] = useState<ProvenanceOrientation>(initialOrientation);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const result = await saveProvenanceSettings({
      provenance_logo_url: logoUrl,
      provenance_signature_url: signaturePath,
      provenance_template_theme: theme,
      provenance_primary_color: primaryColor,
      provenance_accent_color: accentColor,
      provenance_font_pair: fontPair,
      provenance_orientation: orientation,
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const preview = (
    <CertificatePreview
      logoUrl={logoUrl}
      signatureUrl={signatureSignedUrl}
      theme={theme}
      primaryColor={primaryColor}
      accentColor={accentColor}
      fontPair={fontPair}
      orientation={orientation}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 lg:items-start">

      {/* ── Settings form ── */}
      <div className="space-y-10">

        {/* Logo */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Studio logo</h2>
          <p className="text-xs text-stone-400 mb-4">
            Appears in the top-left of each certificate. Works best as a wide horizontal image.
          </p>
          <LogoUploader currentUrl={logoUrl} onUpload={url => setLogoUrl(url)} />
        </section>

        {/* Signature */}
        <section className="space-y-3 border-t border-stone-100 pt-8">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Signature</h2>
            <p className="text-xs text-stone-400 mt-1">
              Appears in the bottom-left of each certificate. Upload a transparent PNG or draw directly below.
              Stored privately — never accessible via a public URL.
            </p>
          </div>
          <SignatureInput
            userId={userId}
            initialPath={signaturePath}
            initialSignedUrl={signatureSignedUrl}
            onSave={(path, signedUrl) => {
              setSignaturePath(path);
              setSignatureSignedUrl(signedUrl);
            }}
          />
        </section>

        {/* Theme */}
        <section className="space-y-4 border-t border-stone-100 pt-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Certificate theme</h2>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  theme === t.value
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className={`h-14 rounded-lg mb-3 flex items-center justify-center text-xs ${
                  t.value === "minimal"   ? "bg-stone-50 border border-stone-100 text-stone-400" :
                  t.value === "editorial" ? "bg-amber-50 border border-amber-100 text-amber-400" :
                                            "bg-stone-900 text-stone-500"
                }`}>
                  {t.label}
                </div>
                <p className={`text-sm font-medium mb-0.5 ${theme === t.value ? "text-stone-900" : "text-stone-600"}`}>
                  {t.label}
                </p>
                <p className="text-xs text-stone-400 leading-relaxed">{t.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Colours */}
        <section className="space-y-3 border-t border-stone-100 pt-8">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Colours</h2>
            <p className="text-xs text-stone-400 mt-1">
              Primary applies to headings and rules; accent to labels and supporting text.
              The certificate background stays off-white for readability.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ColorField
              label="Primary"
              value={primaryColor}
              onChange={setPrimaryColor}
              presets={["#000000", "#1F2937", "#7C2D12", "#1E3A8A", "#064E3B", "#581C87"]}
            />
            <ColorField
              label="Accent"
              value={accentColor}
              onChange={setAccentColor}
              presets={["#888888", "#A1A1AA", "#B45309", "#3B82F6", "#10B981", "#A855F7"]}
            />
          </div>
        </section>

        {/* Font pairing */}
        <section className="space-y-4 border-t border-stone-100 pt-8">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Typography</h2>
            <p className="text-xs text-stone-400 mt-1">
              Pick a heading-and-body pairing. The certificate sets the type sizes — you choose the voice.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FONT_PAIRS.map(p => {
              const active = fontPair === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFontPair(p.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    active ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <p className="text-[15px] mb-0.5" style={{ fontFamily: p.cssHeadingStack, fontWeight: p.cssHeadingWeight }}>
                    {p.label}
                  </p>
                  <p className="text-[11px] text-stone-500" style={{ fontFamily: p.cssBodyStack }}>
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Orientation */}
        <section className="space-y-3 border-t border-stone-100 pt-8">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Page orientation</h2>
            <p className="text-xs text-stone-400 mt-1">
              Portrait suits long artist statements; landscape suits panoramic imagery.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["portrait", "landscape"] as const).map(o => {
              const active = orientation === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrientation(o)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    active ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <div
                    className={`bg-stone-100 border border-stone-200 ${
                      o === "portrait" ? "w-7 h-9" : "w-9 h-7"
                    }`}
                  />
                  <p className={`text-sm font-medium ${active ? "text-stone-900" : "text-stone-600"}`}>
                    {o[0].toUpperCase() + o.slice(1)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Save */}
        <div className="border-t border-stone-100 pt-8 flex items-center gap-4 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && <p className="text-sm text-emerald-600">Saved.</p>}
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <button
            type="button"
            onClick={() => setShowMobilePreview(true)}
            className="lg:hidden ml-auto text-xs text-stone-500 hover:text-stone-700 transition-colors underline"
          >
            Preview certificate
          </button>
        </div>
      </div>

      {/* ── Live preview — desktop right column ── */}
      <div className="hidden lg:block lg:sticky lg:top-8">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-4">Live preview</p>
        {preview}
        <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
          <span className="inline-block border border-dashed border-stone-300 rounded px-1 mr-1 text-stone-500">
            Dashed borders
          </span>
          indicate fields that change per artwork or sale.
        </p>
      </div>

      {/* ── Mobile preview modal ── */}
      {showMobilePreview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end lg:hidden"
          onClick={() => setShowMobilePreview(false)}
        >
          <div
            className="bg-white w-full max-h-[90vh] overflow-y-auto rounded-t-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-stone-900">Certificate preview</p>
              <button
                onClick={() => setShowMobilePreview(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors"
                aria-label="Close preview"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {preview}
            <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
              <span className="inline-block border border-dashed border-stone-300 rounded px-1 mr-1 text-stone-500">
                Dashed borders
              </span>
              indicate fields that change per artwork or sale.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
