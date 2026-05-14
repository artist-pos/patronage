"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkProjectToArtwork } from "@/actions/projects";

interface Props {
  artworkId: string;
  projects: { id: string; title: string; update_count: number }[];
}

export function LinkProjectToArtwork({ artworkId, projects }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    if (!selected) return;
    startTransition(async () => {
      await linkProjectToArtwork(selected, artworkId);
      router.refresh();
    });
  }

  return (
    <section className="border border-stone-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Process thread</p>
          <p className="text-xs text-stone-500 mt-0.5">No project linked</p>
        </div>
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-3">
          {projects.length === 0 ? (
            <p className="text-sm text-stone-500">
              No unlinked projects available. Create one from the{" "}
              <a href="/studio?section=feed&ft=projects" className="underline underline-offset-2 hover:text-stone-800">
                Studio Feed
              </a>
              , or all your existing projects are already linked to other works.
            </p>
          ) : (
            <>
              <p className="text-xs text-stone-500">
                Link a project thread to show the process behind this work.
              </p>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-stone-300 rounded-lg text-sm px-3 py-2 bg-background outline-none focus:border-stone-500"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.update_count > 0 ? ` (${p.update_count} update${p.update_count !== 1 ? "s" : ""})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={!selected || pending}
                className="w-full border border-stone-900 rounded-lg text-sm py-2 hover:bg-stone-900 hover:text-white transition-colors disabled:opacity-40"
              >
                {pending ? "Linking…" : "Link project"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
