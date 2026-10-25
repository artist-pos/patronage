import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { declineClaimInvites } from "./actions";

export const metadata: Metadata = { title: "No more claim emails", robots: { index: false } };

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opt-out for a claim invite. Opening the link changes nothing (mail scanners
 * open links); the button does.
 */
export default async function DeclinePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { done } = await searchParams;

  let organiser: string | null = null;
  if (UUID.test(token)) {
    const admin = createAdminClient();
    const { data } = await admin.from("opportunities").select("organiser").eq("claim_token", token).maybeSingle();
    organiser = (data as { organiser?: string } | null)?.organiser ?? null;
  }

  return (
    <div className="mx-auto max-w-sm space-y-5 px-6 py-20 text-center">
      {done === "1" ? (
        <>
          <p className="text-sm font-semibold">Done</p>
          <p className="text-sm text-muted-foreground">
            We won&rsquo;t send you any more emails about claiming listings. Any listing already on Patronage
            stays up; email{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>{" "}
            if you&rsquo;d like it changed or removed.
          </p>
        </>
      ) : !UUID.test(token) || !organiser ? (
        <>
          <p className="text-sm font-semibold">Link not recognised</p>
          <p className="text-sm text-muted-foreground">
            Email{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>{" "}
            and we&rsquo;ll make sure you aren&rsquo;t contacted again.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">Stop claim emails?</p>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ll stop emailing you about claiming {organiser}&rsquo;s listings on Patronage.
          </p>
          <form action={declineClaimInvites.bind(null, token)}>
            <button
              type="submit"
              className="bg-black px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Yes, stop emailing me
            </button>
          </form>
        </>
      )}
      <Link href="/" className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        ← Back to Patronage
      </Link>
    </div>
  );
}
