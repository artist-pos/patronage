"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReviewerName, upgradeReviewerAccount, type AccountChoice } from "@/app/review/account-actions";

interface Props {
  opportunityId: string;
  organiser: string;
  initialName: string | null;
}

/**
 * Offered to guest reviewers. Never blocks the work: they can dismiss it and keep
 * reviewing, and it comes back next time.
 */
export function AccountPrompt({ opportunityId, organiser, initialName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [savedName, setSavedName] = useState(false);
  const [busy, setBusy] = useState<AccountChoice | "name" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    setBusy("name");
    setError(null);
    const result = await setReviewerName(name);
    setBusy(null);
    if (result.error) setError(result.error);
    else { setSavedName(true); router.refresh(); }
  }

  async function choose(choice: AccountChoice) {
    setBusy(choice);
    setError(null);
    const result = await upgradeReviewerAccount(choice, opportunityId);
    if (result.error) { setBusy(null); setError(result.error); return; }
    if (result.redirectTo) router.push(result.redirectTo);
  }

  return (
    <div className="ams-comfort border border-black/10 bg-stone-50 px-4 py-3 text-base">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-stone-600">
          You&apos;re reviewing as a guest. Create an account to keep your access and use the rest of Patronage.
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="border border-black px-3 py-1.5 text-sm font-medium hover:bg-black hover:text-white transition-colors"
        >
          {open ? "Not now" : "Create an account"}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-black/10 pt-4">
          <div className="space-y-1.5">
            <label htmlFor="reviewer-name" className="text-sm font-medium uppercase tracking-widest text-stone-500">
              What should we call you?
            </label>
            <div className="flex gap-2">
              <input
                id="reviewer-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setSavedName(false); }}
                className="min-w-0 flex-1 border border-black/30 px-3 py-2 text-base focus:border-black focus:outline-none"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={busy !== null || !name.trim()}
                className="border border-black px-3 py-2 text-sm font-medium hover:bg-black hover:text-white disabled:opacity-40"
              >
                {busy === "name" ? "Saving…" : savedName ? "Saved" : "Save"}
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ["organisation", `Join ${organiser}`, "Work with this organisation on Patronage."],
              ["artist", "I'm an artist", "Build a profile and apply to opportunities."],
              ["patron", "I'm a patron", "Support artists and collect work."],
            ] as Array<[AccountChoice, string, string]>).map(([key, label, hint]) => (
              <button
                key={key}
                type="button"
                onClick={() => choose(key)}
                disabled={busy !== null}
                className="border border-black/20 bg-white p-3 text-left hover:border-black disabled:opacity-50"
              >
                <span className="block text-sm font-semibold">{busy === key ? "One moment…" : label}</span>
                <span className="mt-0.5 block text-sm text-stone-500">{hint}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-stone-500">Your review access stays exactly as it is.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
