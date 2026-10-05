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
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NAV_LINKS } from "./HeaderNav";

interface NavBarProps {
  isLoggedIn: boolean;
  username: string | null;
  userId: string | null;
  unreadCount: number;
  unreadNotifications: number;
  signOut: () => Promise<void>;
  role?: string | null;
}

export function NavBar({ isLoggedIn, username, userId, unreadCount, unreadNotifications, signOut, role }: NavBarProps) {
  const isArtist = role === "artist" || role === "owner";
  const [open, setOpen] = useState(false);

  const workspaceLabel = isArtist ? "Studio" : "Dashboard";

  return (
    <>
      {/* ── Desktop right column ──────────────────────── */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        {isLoggedIn && userId && (
          <NotificationBell userId={userId} initialUnreadCount={unreadNotifications} />
        )}
        {isLoggedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
              {username ?? "My Account"}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border border-border">
              {username && (
                <DropdownMenuItem asChild>
                  <Link href={`/${username}`}>Profile</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/studio">{workspaceLabel}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messages" className="flex items-center gap-2">
                  Messages
                  {unreadCount > 0 && (
                    <span className="w-1.5 h-1.5 bg-black rounded-full" />
                  )}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut()}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-brand text-white text-[13px] font-medium px-4 py-[7px] hover:opacity-85 transition-opacity"
            >
              Get started
            </Link>
          </div>
        )}
      </div>

      {/* ── Mobile icons row (notifications + hamburger) ─────── */}
      <div className="sm:hidden flex items-center gap-3">
        {isLoggedIn && userId && (
          <NotificationBell userId={userId} initialUnreadCount={unreadNotifications} />
        )}
      <button
        className="flex flex-col gap-1.5 p-1 shrink-0"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "translate-y-[7px] rotate-45" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
      </button>
      </div>

      {/* ── Mobile drawer ─────────────────────────────── */}
      {open && (
        <div className="sm:hidden absolute top-full right-0 bg-background border border-border shadow-lg z-50 px-6 py-4 flex flex-col gap-4 text-sm min-w-[200px]">
          {isLoggedIn && NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className={isLoggedIn ? "border-t border-border pt-4 flex flex-col gap-3" : "flex flex-col gap-3"}>
            {isLoggedIn ? (
              <>
                {username && (
                  <Link href={`/${username}`} onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    Profile
                  </Link>
                )}
                <Link href="/studio" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {workspaceLabel}
                </Link>
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Messages
                  {unreadCount > 0 && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                </Link>
                <Link href="/settings" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  Settings
                </Link>
                <div className="border-t border-border pt-3">
                  <form action={signOut}>
                    <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors">
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </Link>
                <Link href="/auth/signup" onClick={() => setOpen(false)} className="bg-brand text-white text-center text-[13px] font-medium px-4 py-2 hover:opacity-85 transition-opacity">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
