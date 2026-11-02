"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "lucide-react";
import { setAppreciation } from "@/actions/appreciations";

interface Props {
  updateId: string;
  /** Whether the viewer has already appreciated it. May arrive after mount. */
  appreciated?: boolean;
  /** false sends straight to sign-in; unset lets the server decide. */
  isAuthenticated?: boolean;
  onDark?: boolean;
  /** "icon" for tiles; "button" (labelled) for a detail page. */
  variant?: "icon" | "button";
}

/**
 * A private appreciation (225). The viewer only ever sees their own mark: no
 * counts, no list of who, no ranking. The artist gets a count on Mondays.
 */
export function AppreciateButton({ updateId, appreciated = false, isAuthenticated, onDark = false, variant = "icon" }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(appreciated);
  const [pending, startTransition] = useTransition();

  // The feed learns the viewer's appreciations after the tiles mount.
  useEffect(() => setOn(appreciated), [appreciated]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isAuthenticated === false) {
      router.push("/auth/login");
      return;
    }
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await setAppreciation(updateId, next);
      if (res.error === "Not authenticated") {
        setOn(!next);
        router.push("/auth/login");
      } else if (res.error) {
        setOn(!next);
      }
    });
  }

  const label = on ? "Appreciated. Only the artist hears about this." : "Appreciate. Only the artist hears about this.";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        title={label}
        className="inline-flex h-9 items-center gap-2 border border-border px-3 text-[13px] transition-colors hover:border-foreground disabled:opacity-60"
      >
        <Sparkle className="h-4 w-4" fill={on ? "currentColor" : "none"} aria-hidden />
        {on ? "Appreciated" : "Appreciate"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors disabled:opacity-60 ${
        onDark ? "text-white hover:bg-white/15" : "text-muted-foreground hover:bg-muted"
      } ${on ? (onDark ? "text-white" : "text-foreground") : ""}`}
    >
      <Sparkle className="h-3.5 w-3.5" fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
