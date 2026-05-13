"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { saveEmbedConfig } from "@/app/dashboard/collection/embed-actions";
import type { PatronEmbedConfig } from "@/types/database";

interface Props {
  initialConfig: PatronEmbedConfig;
  username: string;
  siteUrl: string;
}

function configToParams(c: PatronEmbedConfig): string {
  const params = new URLSearchParams({
    rh: String(c.row_height),
    gh: String(c.gap_h),
    gv: String(c.gap_v),
    title: c.show_title ? "1" : "0",
    artist: c.show_artist ? "1" : "0",
    year: c.show_year ? "1" : "0",
    medium: c.show_medium ? "1" : "0",
    trust: c.show_trust ? "1" : "0",
    theme: c.theme,
  });
  if (c.theme === "light" && c.bg_color && c.bg_color !== "#fafaf8") {
    params.set("bg", c.bg_color.replace(/^#/, ""));
  }
  return params.toString();
}

function configToEmbedHtml(c: PatronEmbedConfig, username: string, siteUrl: string): string {
  const params = configToParams(c);
  return `<iframe\n  src="${siteUrl}/embed/${username}/collection?${params}"\n  width="100%" height="600" frameborder="0"\n  style="border:none;"\n></iframe>`;
}

export function EmbedConfigurator({ initialConfig, username, siteUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<PatronEmbedConfig>(initialConfig);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const debouncedSave = useCallback((cfg: PatronEmbedConfig) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveEmbedConfig(cfg);
      setSaving(false);
    }, 800);
  }, []);

  function update(patch: Partial<PatronEmbedConfig>) {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      debouncedSave(next);
      return next;
    });
  }

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const embedHtml = configToEmbedHtml(config, username, siteUrl);
  const previewSrc = `${siteUrl}/embed/${username}/collection?${configToParams(config)}`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedHtml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Embed configurator</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Customise your collection embed for your website
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-stone-400">Saving…</span>}
          <svg
            className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-200 px-5 py-6 space-y-6 bg-stone-50">

          {/* Row height */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-600">Row height</label>
              <span className="text-xs text-stone-400">{config.row_height}px</span>
            </div>
            <input
              type="range" min={80} max={400} step={10}
              value={config.row_height}
              onChange={(e) => update({ row_height: parseInt(e.target.value, 10) })}
              className="w-full accent-stone-900"
            />
          </div>

          {/* Gaps */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-600">Horizontal gap</label>
                <span className="text-xs text-stone-400">{config.gap_h}px</span>
              </div>
              <input
                type="range" min={0} max={40} step={2}
                value={config.gap_h}
                onChange={(e) => update({ gap_h: parseInt(e.target.value, 10) })}
                className="w-full accent-stone-900"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-600">Vertical gap</label>
                <span className="text-xs text-stone-400">{config.gap_v}px</span>
              </div>
              <input
                type="range" min={0} max={40} step={2}
                value={config.gap_v}
                onChange={(e) => update({ gap_v: parseInt(e.target.value, 10) })}
                className="w-full accent-stone-900"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-600">Show in caption</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["show_title", "Title"],
                  ["show_artist", "Artist"],
                  ["show_year", "Year"],
                  ["show_medium", "Medium"],
                  ["show_trust", "Trust tier"],
                ] as [keyof PatronEmbedConfig, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!config[key]}
                    onChange={(e) => update({ [key]: e.target.checked })}
                    className="accent-stone-900 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-stone-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-600">Theme</p>
            <div className="flex gap-2">
              {(["light", "dark", "transparent"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ theme: t })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
                    config.theme === t
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-600">Preview</p>
            <div className="border border-stone-200 rounded-lg overflow-hidden bg-white" style={{ height: 280 }}>
              <iframe
                key={previewSrc}
                src={previewSrc}
                className="w-full h-full border-0"
                title="Embed preview"
              />
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-600">Embed code</p>
            <div className="relative">
              <pre className="bg-white border border-stone-200 rounded-lg px-4 py-3 text-xs text-stone-700 overflow-x-auto whitespace-pre-wrap break-all">
                {embedHtml}
              </pre>
              <button
                type="button"
                onClick={copyEmbed}
                className="absolute top-2 right-2 text-xs bg-stone-900 text-white rounded px-2.5 py-1 hover:opacity-90 transition-opacity"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
