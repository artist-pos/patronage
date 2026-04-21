import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimEmailInvitation } from "@/app/profile/collective-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accept Invitation — Patronage" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Invalid invitation</h1>
          <p className="text-sm text-muted-foreground">This link is missing an invitation token.</p>
          <Link href="/" className="inline-block text-xs text-muted-foreground underline underline-offset-2">← Back to Patronage</Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — prompt to sign up or log in, preserving the token
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">You&apos;ve been invited</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You&apos;ve been invited to join a collective on Patronage. Sign up or log in to accept.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/auth/signup?next=/join?token=${token}`}
              className="w-full text-center text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
            >
              Create an account
            </Link>
            <Link
              href={`/auth/login?next=/join?token=${token}`}
              className="w-full text-center text-sm border border-border px-4 py-2.5 hover:bg-muted transition-colors"
            >
              Log in
            </Link>
          </div>
          <Link href="/" className="block text-center text-xs text-muted-foreground underline underline-offset-2">← Back to Patronage</Link>
        </div>
      </div>
    );
  }

  // Logged in — claim the invitation
  const result = await claimEmailInvitation(token);

  if (result.error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{result.error}</p>
          <Link href="/studio?section=profile" className="inline-block text-sm underline underline-offset-2">
            View your collectives →
          </Link>
        </div>
      </div>
    );
  }

  // Success — redirect to profile settings collectives tab
  redirect("/studio?section=profile");
}
