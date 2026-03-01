"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavBarProps {
  isLoggedIn: boolean;
  username: string | null;
  unreadCount: number;
  signOut: () => Promise<void>;
}

// Duplicated here for the mobile drawer only
const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/artists", label: "Artists" },
  { href: "/partners", label: "Partners" },
];

export function NavBar({ isLoggedIn, username, unreadCount, signOut }: NavBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop right column ──────────────────────── */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        {isLoggedIn ? (
          <>
            {/* Messages with unread dot */}
            <Link
              href="/messages"
              className="relative text-muted-foreground hover:text-foreground transition-colors"
            >
              Messages
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-2.5 w-1.5 h-1.5 bg-black rounded-full" />
              )}
            </Link>

            {/* Account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                {username ?? "My Account"}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border border-black">
                {username && (
                  <DropdownMenuItem asChild>
                    <Link href={`/${username}`}>View Public Profile</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile/edit">Edit Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/analytics">My Analytics</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="border border-border px-3 py-1.5 hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* ── Mobile hamburger ─────────────────────────── */}
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
                {username && (
                  <Link
                    href={`/${username}`}
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View Public Profile
                  </Link>
                )}
                <Link
                  href="/profile/edit"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/profile/analytics"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Analytics
                </Link>
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Messages
                  {unreadCount > 0 && (
                    <span className="w-1.5 h-1.5 bg-black rounded-full" />
                  )}
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
