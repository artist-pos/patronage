import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getUnreadCount } from "@/lib/messages";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { NavBar } from "./NavBar";
import { HeaderNav } from "./HeaderNav";
import { SearchCommand } from "@/components/search/SearchCommand";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function Header() {
  // Request-deduped auth — Header, MobileTabBarServer, and the page share one
  // auth.getUser() network round-trip per request instead of 3-4.
  const { user } = await getServerUser();

  const [profile, unreadCount, unreadNotifications] = await Promise.all([
    user ? getProfileById(user.id) : Promise.resolve(null),
    user ? getUnreadCount() : Promise.resolve(0),
    user ? getUnreadNotificationCount(user.id) : Promise.resolve(0),
  ]);

  return (
    <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-lg">
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 h-[52px] flex items-stretch gap-4 sm:gap-6">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 shrink-0 sm:mr-2 text-[15px] font-semibold tracking-tight">
          <Image src="/Favicon_Bleed_512.png" alt="Patronage" width={22} height={22} />
          <span className="hidden sm:inline">Patronage</span>
        </Link>

        {/* ── Primary nav (desktop, left-aligned mono, role-aware) ── */}
        <HeaderNav role={profile?.role ?? null} isLoggedIn={!!user} />

        {/* ── Search bar — dead-centre of the header on desktop (inner div is
               absolutely centred; the outer keeps its flex slot so the
               account column stays pinned right), in-flow below xl ── */}
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex w-full items-center xl:absolute xl:left-1/2 xl:top-0 xl:h-full xl:max-w-sm xl:-translate-x-1/2">
            <SearchCommand />
          </div>
        </div>

        {/* ── Account + mobile hamburger ── */}
        <div className="flex items-center">
          <NavBar
            isLoggedIn={!!user}
            username={profile?.username ?? null}
            userId={user?.id ?? null}
            unreadCount={unreadCount}
            unreadNotifications={unreadNotifications}
            signOut={signOut}
            role={profile?.role ?? null}
          />
        </div>

      </div>
    </header>
  );
}
