import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { NavBar } from "./NavBar";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getProfileById(user.id) : null;

  return (
    <header className="border-b border-border relative">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Patronage
        </Link>
        <NavBar
          isLoggedIn={!!user}
          profileHref={profile?.username ? `/${profile.username}` : "/onboarding"}
          profileLabel={profile?.username ?? "My profile"}
          signOut={signOut}
        />
      </div>
    </header>
  );
}
