"use client";

import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { updateProfilePrivacy, updateProfilePrivacyBulk } from "@/app/profile/privacy-actions";

const SHOW_FIELDS = [
  { key: "collection_public" as const, label: "Collection visible on profile" },
  { key: "show_taste" as const, label: "Show taste" },
  { key: "show_follows" as const, label: "Show who you follow" },
  { key: "show_location" as const, label: "Show location" },
  { key: "show_previously_collected" as const, label: "Show previously collected works" },
  { key: "show_supporting" as const, label: "Show artists you support" },
] as const;

type FieldKey = typeof SHOW_FIELDS[number]["key"];

interface Props {
  initial: Record<FieldKey, boolean>;
}

function allPublic(fields: Record<FieldKey, boolean>): boolean {
  return SHOW_FIELDS.every((f) => fields[f.key]);
}

export function PrivacySection({ initial }: Props) {
  const [fields, setFields] = useState<Record<FieldKey, boolean>>(initial);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const isPublic = allPublic(fields);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  function setMasterToggle(makePublic: boolean) {
    const next = { ...fields };
    for (const f of SHOW_FIELDS) {
      next[f.key] = makePublic;
    }
    setFields(next);
    startTransition(async () => {
      const result = await updateProfilePrivacyBulk(
        Object.fromEntries(SHOW_FIELDS.map((f) => [f.key, makePublic]))
      );
      if (result?.error) {
        // Revert on failure
        setFields(initial);
        showToast(result.error);
      } else {
        showToast(makePublic ? "Profile set to public." : "Profile set to private.");
      }
    });
  }

  function toggleField(key: FieldKey) {
    const next = !fields[key];
    setFields((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      const result = await updateProfilePrivacy(key, next);
      if (result?.error) {
        setFields((prev) => ({ ...prev, [key]: !next }));
        showToast(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Master toggle — radio-style */}
      <fieldset className="space-y-3" disabled={isPending}>
        <legend className="sr-only">Profile privacy</legend>
        <button
          type="button"
          onClick={() => { if (!isPublic) setMasterToggle(true); }}
          className="flex items-center gap-3 cursor-pointer group text-left w-full"
          role="radio"
          aria-checked={isPublic}
        >
          <span
            className={[
              "relative flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors",
              isPublic ? "border-black" : "border-stone-300 group-hover:border-stone-400",
            ].join(" ")}
            aria-hidden="true"
          >
            {isPublic && <span className="w-2.5 h-2.5 rounded-full bg-black" />}
          </span>
          <span className="text-sm font-medium">Public profile</span>
        </button>
        <button
          type="button"
          onClick={() => { if (isPublic) setMasterToggle(false); }}
          className="flex items-center gap-3 cursor-pointer group text-left w-full"
          role="radio"
          aria-checked={!isPublic}
        >
          <span
            className={[
              "relative flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors",
              !isPublic ? "border-black" : "border-stone-300 group-hover:border-stone-400",
            ].join(" ")}
            aria-hidden="true"
          >
            {!isPublic && <span className="w-2.5 h-2.5 rounded-full bg-black" />}
          </span>
          <span className="text-sm font-medium">Private profile</span>
        </button>
      </fieldset>

      {/* Expandable granular controls */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={[
              "w-3.5 h-3.5 transition-transform",
              expanded ? "rotate-90" : "",
            ].join(" ")}
          />
          Choose what&apos;s shown
        </button>

        {expanded && (
          <div className="mt-3 ml-5 space-y-2.5">
            {SHOW_FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={fields[f.key]}
                  onChange={() => toggleField(f.key)}
                  disabled={isPending}
                  className="sr-only peer"
                />
                <span
                  className={[
                    "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                    fields[f.key]
                      ? "bg-black border-black"
                      : "border-stone-300 group-hover:border-stone-400",
                    isPending ? "opacity-50" : "",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {fields[f.key] && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <p className="text-xs text-muted-foreground">{toast}</p>
      )}
    </div>
  );
}
