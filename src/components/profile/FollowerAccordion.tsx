"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { FollowerProfile } from "@/lib/follows";

interface Props {
  followers: FollowerProfile[];
}

export function FollowerAccordion({ followers }: Props) {
  const [open, setOpen] = useState(false);

  if (followers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Your community is just beginning.</p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? "Hide" : "View All"} ({followers.length})
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-1.5">
          {followers.map((f) => (
            <Link
              key={f.id}
              href={`/${f.username}`}
              className="flex items-center gap-3 p-2.5 border border-border hover:bg-muted/30 transition-colors"
            >
              {f.avatar_url ? (
                <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
                  <Image
                    src={f.avatar_url}
                    alt={f.full_name ?? f.username}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 shrink-0 border border-black bg-muted flex items-center justify-center text-xs font-medium">
                  {(f.full_name ?? f.username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{f.full_name ?? f.username}</p>
                <p className="text-xs text-muted-foreground">@{f.username}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
