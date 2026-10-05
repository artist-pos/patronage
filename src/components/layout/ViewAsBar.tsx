"use client";

import { useTransition } from "react";
import { setViewAs } from "@/actions/view-as";
import type { ViewAsRole } from "@/lib/view-as";

const ROLES: { value: ViewAsRole | null; label: string }[] = [
  { value: null, label: "Owner" },
  { value: "artist", label: "Artist" },
  { value: "patron", label: "Patron" },
  { value: "partner", label: "Partner" },
];

interface Props {
  currentViewAs: ViewAsRole | null;
}

export function ViewAsBar({ currentViewAs }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSwitch(role: ViewAsRole | null) {
    startTransition(async () => {
      await setViewAs(role);
    });
  }

  const activeLabel = ROLES.find((r) => r.value === currentViewAs)?.label ?? "Owner";

  return (
    <div className="sticky top-0 z-50 bg-stone-900 text-white h-8 flex items-center justify-center gap-3 text-xs font-medium select-none">
      <span className="text-stone-400 mr-1">Viewing as:</span>
      {ROLES.map((r) => {
        const isActive =
          (r.value === null && currentViewAs === null) ||
          r.value === currentViewAs;
        return (
          <button
            key={r.value ?? "owner"}
            onClick={() => handleSwitch(r.value)}
            disabled={isPending || isActive}
            className={`px-2 py-0.5 rounded transition-colors ${
              isActive
                ? "bg-white text-stone-900"
                : "text-stone-300 hover:text-white hover:bg-stone-700"
            } disabled:cursor-default`}
          >
            {r.label}
          </button>
        );
      })}
      {currentViewAs && (
        <button
          onClick={() => handleSwitch(null)}
          disabled={isPending}
          className="ml-2 text-stone-400 hover:text-white underline underline-offset-2 transition-colors"
        >
          Exit
        </button>
      )}
      {isPending && (
        <span className="text-stone-500 ml-1">Switching…</span>
      )}
    </div>
  );
}
