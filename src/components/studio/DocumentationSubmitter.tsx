"use client";

import { useState } from "react";
import type { PostSelectionDocField } from "@/types/database";
import { submitDocumentation } from "@/app/studio/applications/actions";
import { createClient } from "@/lib/supabase/client";
import { Upload, CheckCircle } from "lucide-react";

interface Props {
  applicationId: string;
  fields: PostSelectionDocField[];
  initial: Record<string, string>;
}

export function DocumentationSubmitter({ applicationId, fields, initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function setValue(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
    setSaved(false);
  }

  async function handleFileUpload(field: PostSelectionDocField, file: File) {
    setUploading(field.id);
    try {
      const path = `${applicationId}/${field.id}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("application-docs")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }
      const { data } = supabase.storage.from("application-docs").getPublicUrl(path);
      setValue(field.id, data.publicUrl);
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await submitDocumentation(applicationId, values);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <label className="text-xs font-medium text-stone-700">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-stone-400">{field.description}</p>
          )}
          {field.type === "text" && (
            <input
              type="text"
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
            />
          )}
          {field.type === "rich_text" && (
            <textarea
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
              rows={4}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-black resize-y"
            />
          )}
          {field.type === "link" && (
            <input
              type="url"
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
              placeholder="https://"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
            />
          )}
          {field.type === "file" && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs border border-stone-200 rounded-lg px-3 py-2 cursor-pointer hover:border-stone-400 transition-colors w-fit">
                <Upload size={13} className="text-stone-400" />
                {uploading === field.id ? "Uploading…" : values[field.id] ? "Replace file" : "Upload file"}
                <input
                  type="file"
                  className="sr-only"
                  disabled={uploading === field.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(field, file);
                  }}
                />
              </label>
              {values[field.id] && (
                <a
                  href={values[field.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-500 underline underline-offset-2"
                >
                  View uploaded file
                </a>
              )}
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 text-xs bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
      >
        {saved && <CheckCircle size={13} />}
        {saving ? "Saving…" : saved ? "Saved" : "Submit documentation"}
      </button>
    </form>
  );
}
