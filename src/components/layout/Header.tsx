import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getUnreadCount } from "@/lib/messages";
import { NavBar } from "./NavBar";
import { SearchCommand } from "@/components/search/SearchCommand";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/artists", label: "Artists" },
  { href: "/opportunities", label: "Opportunities" },
];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getProfileById(user.id) : null;
  const unreadCount = user ? await getUnreadCount() : 0;

  return (
    <header className="border-b border-border sticky top-0 z-40 bg-background">
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-6">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 shrink-0 text-base font-semibold tracking-tight">
          <Image src="/Favicon_Bleed_512.png" alt="Patronage" width={24} height={24} />
          <span className="hidden sm:inline">Patronage</span>
        </Link>

        {/* ── Search bar ── */}
        <SearchCommand />

        {/* ── Center nav (desktop only, absolutely centered) ── */}
        <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 text-sm pointer-events-auto">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Account + mobile hamburger ── */}
        <div className="ml-auto">
          <NavBar
            isLoggedIn={!!user}
            username={profile?.username ?? null}
            unreadCount={unreadCount}
            signOut={signOut}
            role={profile?.role ?? null}
          />
        </div>

      </div>
    </header>
  );
}
