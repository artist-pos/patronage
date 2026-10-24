import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getInviteByToken } from "@/lib/rabobank/invites";
import { keepAsPatronageProfile } from "@/lib/rabobank/keep";
import { COPY } from "@/lib/rabobank/artist-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: COPY.keep.heading, robots: { index: false, follow: false } };

/**
 * Lands here from the "keep my profile" sign-in link. Signing in already took a
 * deliberate button press on /auth/confirm, so the conversion runs on arrival.
 * The signed-in email must match the one the link was sent to.
 */
export default async function KeepProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) notFound();
  const { user } = await getServerUser();

  let body: React.ReactNode;
  if (!user) {
    body = (
      <>
        <p className="leading-relaxed text-stone-600">{COPY.keep.body}</p>
        <Link href={`/auth/login?next=${encodeURIComponent(`/rabobank-keep/${token}`)}`} className="inline-flex min-h-12 items-center rounded-lg bg-black px-6 font-medium text-white">
          {COPY.keep.button}
        </Link>
      </>
    );
  } else if (invite.email && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    body = <p className="leading-relaxed text-stone-600">{COPY.keep.wrongAccount}</p>;
  } else {
    const r = await keepAsPatronageProfile(user.id, user.email ?? null, invite);
    body = r.ok ? (
      <>
        <p className="text-lg leading-relaxed">{COPY.keep.done}</p>
        <Link href={`/${r.username}`} className="inline-flex min-h-12 items-center rounded-lg bg-black px-6 font-medium text-white">
          {COPY.keep.viewProfile}
        </Link>
      </>
    ) : (
      <p className="leading-relaxed text-red-700" role="alert">{r.error}</p>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className="text-4xl font-light tracking-tight">{COPY.keep.heading}</h1>
        {body}
      </div>
    </div>
  );
}
