"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  isLoggedIn: boolean;
  username: string | null;
  role: string | null;
}

/* Mockup icon set (Mobile Home.dc.html) — square linecaps, 20px viewBox.
   Active tab = filled civic teal; inactive = fg-muted stroke. */

function MasonryIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--brand)">
        <rect x="0" y="0" width="8" height="12" />
        <rect x="10" y="0" width="10" height="7" />
        <rect x="0" y="14" width="8" height="6" />
        <rect x="10" y="9" width="10" height="11" />
      </svg>
    );
  }
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none"
      stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"
    >
      <rect x="0.75" y="0.75" width="6.5" height="10.5" />
      <rect x="10.75" y="0.75" width="8.5" height="5.5" />
      <rect x="0.75" y="14.25" width="6.5" height="4.5" />
      <rect x="10.75" y="9.75" width="8.5" height="9.5" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="8" r="5.5" fill="var(--brand)" />
        <circle cx="8" cy="8" r="3" fill="var(--surface)" />
        <line x1="12.5" y1="12.5" x2="18.5" y2="18.5" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    );
  }
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none"
      stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"
    >
      <circle cx="8" cy="8" r="5.5" />
      <line x1="12.5" y1="12.5" x2="18.5" y2="18.5" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--brand)">
        <circle cx="10" cy="5.5" r="3.5" />
        <path d="M2 19 C2 13.5 5 11 10 11 C15 11 18 13.5 18 19 Z" />
      </svg>
    );
  }
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none"
      stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"
    >
      <circle cx="10" cy="5.5" r="3.5" />
      <path d="M2 19 C2 13.5 5 11 10 11 C15 11 18 13.5 18 19" />
    </svg>
  );
}

/**
 * Mobile bottom nav — straight from the mobile mockup: four icon-only items
 * (explore masonry / opportunities magnifier / artists person / black "+"
 * square), frosted white bar, hides on scroll down and returns on scroll up.
 * The "+" opens an action sheet (New update / New work) for artists and
 * routes everyone else to sign-up.
 */
export function MobileTabBar({ isLoggedIn, username, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isArtist = role === "artist" || role === "owner";
  const [hidden, setHidden] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const lastY = useRef(0);

  // Hide on scroll down (past 80px), reappear on scroll up — per the mockup
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 80);
      lastY.current = y <= 0 ? 0 : y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the sheet on navigation
  useEffect(() => setSheetOpen(false), [pathname]);

  const exploreActive = pathname === "/feed" || pathname.startsWith("/feed/") || pathname === "/works";
  const oppsActive = pathname === "/opportunities" || pathname.startsWith("/opportunities/");
  const artistsActive =
    pathname === "/artists" || (username ? pathname === `/${username}` : false);

  function onPlus() {
    if (isArtist) {
      setSheetOpen(true);
    } else if (isLoggedIn) {
      router.push("/opportunities");
    } else {
      router.push("/auth/signup");
    }
  }

  return (
    <>
      {/* Spacer — reserves the bar's height in normal flow */}
      <div aria-hidden className="h-12 sm:hidden" />

      <nav
        aria-label="Mobile navigation"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/92 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-[16px] transition-transform duration-200 sm:hidden ${
          hidden ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="flex items-center justify-around">
          <Link href="/feed" aria-label="Explore" className="px-3.5 py-1">
            <MasonryIcon active={exploreActive} />
          </Link>
          <Link href="/opportunities" aria-label="Opportunities" className="px-3.5 py-1">
            <SearchIcon active={oppsActive} />
          </Link>
          <Link href="/artists" aria-label="Artists" className="px-3.5 py-1">
            <PersonIcon active={artistsActive} />
          </Link>
          <button type="button" aria-label="Post" onClick={onPlus} className="px-3.5 py-1">
            <span className="flex h-7 w-7 items-center justify-center bg-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="square">
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
            </span>
          </button>
        </div>
      </nav>

      {/* Action sheet — artists only */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/48 sm:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}
        >
          <div className="absolute inset-x-0 bottom-0 bg-card pb-[calc(12px+env(safe-area-inset-bottom))]">
            <div className="flex justify-center pb-1 pt-2.5">
              <div className="h-[3px] w-9 bg-border" />
            </div>
            <Link
              href="/feed"
              className="block w-full border-b border-border px-[18px] py-[15px] text-left font-mono text-sm"
              onClick={() => setSheetOpen(false)}
            >
              New update
            </Link>
            <Link
              href="/studio/works/new"
              className="block w-full border-b border-border px-[18px] py-[15px] text-left font-mono text-sm"
              onClick={() => setSheetOpen(false)}
            >
              New work
            </Link>
            <button
              type="button"
              className="block w-full px-[18px] py-[15px] text-left font-mono text-sm text-muted-foreground"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
