import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";

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
    <header className="border-b border-border">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Patronage
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/opportunities"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Opportunities
          </Link>
          <Link
            href="/artists"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Artists
          </Link>
          <Link
            href="/partners"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            For Partners
          </Link>
          {user ? (
            <div className="flex items-center gap-4 border-l border-border pl-6">
              <Link
                href={profile?.username ? `/${profile.username}` : "/onboarding"}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {profile?.username ?? "My profile"}
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
              className="border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
