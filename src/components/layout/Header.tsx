import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getUnreadCount } from "@/lib/messages";
import { NavBar } from "./NavBar";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/artists", label: "Artists" },
  { href: "/partners", label: "Partners" },
];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getProfileById(user.id) : null;
  const unreadCount = user ? await getUnreadCount() : 0;

  return (
    <header className="border-b border-border relative">
      <div className="max-w-[1600px] mx-auto px-6 py-4 grid grid-cols-3 items-center">

        {/* ── Left: Logo ── */}
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Image src="/Favicon.png" alt="Patronage" width={24} height={24} />
          Patronage
        </Link>

        {/* ── Center: Primary nav links (desktop only) ── */}
        <nav className="hidden sm:flex items-center justify-center gap-12 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Right: Messages + account + mobile hamburger ── */}
        <div className="flex justify-end">
          <NavBar
            isLoggedIn={!!user}
            username={profile?.username ?? null}
            unreadCount={unreadCount}
            signOut={signOut}
          />
        </div>

      </div>
    </header>
  );
}
