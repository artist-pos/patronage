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
  role?: string | null;
}

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/artists", label: "Artists" },
  { href: "/opportunities", label: "Opportunities" },
];

export function NavBar({ isLoggedIn, username, unreadCount, signOut, role }: NavBarProps) {
  const isArtist = role === "artist" || role === "owner";
  const isPartner = role === "partner" || role === "admin";
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop right column ──────────────────────── */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <a
          href="https://discord.gg/aZKNauz88y"
          target="_blank"
          rel="noopener noreferrer"
          title="Join the community"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Join the Patronage Discord community"
        >
          <svg width="18" height="14" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
        </a>
        {isLoggedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
              {username ?? "My Account"}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border border-black">
              {username && (
                <DropdownMenuItem asChild>
                  <Link href={`/${username}`}>Profile</Link>
                </DropdownMenuItem>
              )}
              {isArtist && (
                <DropdownMenuItem asChild>
                  <Link href="/studio">Studio</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/collection">Collection</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messages" className="flex items-center gap-2">
                  Messages
                  {unreadCount > 0 && (
                    <span className="w-1.5 h-1.5 bg-black rounded-full" />
                  )}
                </Link>
              </DropdownMenuItem>
              {isPartner && (
                <DropdownMenuItem asChild>
                  <Link href="/partner/dashboard">Partner Dashboard</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut()}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        className="sm:hidden flex flex-col gap-1.5 p-1 shrink-0"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "translate-y-[7px] rotate-45" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`block w-5 h-px bg-foreground transition-transform origin-center ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
      </button>

      {/* ── Mobile drawer ─────────────────────────────── */}
      {open && (
        <div className="sm:hidden absolute top-full right-0 bg-background border border-border shadow-md z-50 px-6 py-4 flex flex-col gap-4 text-sm min-w-[200px]">
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
          <a
            href="https://discord.gg/aZKNauz88y"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            <svg width="16" height="12" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Join the community
          </a>
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            {isLoggedIn ? (
              <>
                {username && (
                  <Link href={`/${username}`} onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    Profile
                  </Link>
                )}
                {isArtist && (
                  <Link href="/studio" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    Studio
                  </Link>
                )}
                <Link href="/dashboard" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <Link href="/dashboard/collection" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  Collection
                </Link>
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Messages
                  {unreadCount > 0 && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                </Link>
                {isPartner && (
                  <Link href="/partner/dashboard" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    Partner Dashboard
                  </Link>
                )}
                <div className="border-t border-border pt-3">
                  <form action={signOut}>
                    <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors">
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <Link href="/auth/login" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
