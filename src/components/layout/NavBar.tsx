"use client";

import { useState } from "react";
import Link from "next/link";

interface NavBarProps {
  profileHref: string;
  profileLabel: string;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
}

const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/artists", label: "Artists" },
  { href: "/partners", label: "For Partners" },
];

export function NavBar({ profileHref, profileLabel, isLoggedIn, signOut }: NavBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop nav ──────────────────────────────── */}
      <nav className="hidden sm:flex items-center gap-6 text-sm">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {l.label}
          </Link>
        ))}
        {isLoggedIn ? (
          <div className="flex items-center gap-4 border-l border-border pl-6">
            <Link
              href={profileHref}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {profileLabel}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="border border-border px-3 py-1.5 hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        )}
      </nav>

      {/* ── Mobile hamburger button ───────────────────── */}
      <button
        className="sm:hidden flex flex-col gap-1.5 p-1"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "translate-y-[7px] rotate-45" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
      </button>

      {/* ── Mobile drawer ─────────────────────────────── */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-background border-b border-border z-50 px-6 py-4 flex flex-col gap-4 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href={profileHref}
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {profileLabel}
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
