"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Update {
  id: string;
  content_type: string;
  image_url: string | null;
  caption: string | null;
  text_content: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  updates: Update[];
}

export function ProcessThread({ projectId, projectTitle, updates }: Props) {
  const [open, setOpen] = useState(false);
  const count = updates.length;

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
          <p className="text-xs text-stone-500 mt-0.5">
            {count === 0
              ? "No updates yet"
              : `${count} update${count !== 1 ? "s" : ""} — ${projectTitle}`}
          </p>
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
        <div className="border-t border-stone-100">
          {count === 0 ? (
            <p className="px-5 py-4 text-sm text-stone-500">No updates in this project yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {updates.map((u) => (
                <div key={u.id} className="px-5 py-4 flex gap-4">
                  {u.image_url && (
                    <div className="w-16 h-16 shrink-0 relative rounded overflow-hidden bg-stone-100">
                      <Image
                        src={u.image_url}
                        alt={u.caption ?? ""}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {u.caption && (
                      <p className="text-sm text-stone-800 line-clamp-2">{u.caption}</p>
                    )}
                    {u.text_content && !u.caption && (
                      <p className="text-sm text-stone-800 line-clamp-2">{u.text_content}</p>
                    )}
                    <p className="text-[11px] text-stone-400">
                      {new Date(u.created_at).toLocaleDateString("en-NZ", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-stone-100">
            <Link
              href={`/threads/${projectId}`}
              className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800 transition-colors"
            >
              View full thread →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
