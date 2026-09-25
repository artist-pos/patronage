import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unsubscribe" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;

  let status: "success" | "missing" | "not_found" | "error" = "missing";

  // Both token columns are uuid, so a malformed value would make Postgres
  // raise a type error rather than simply miss. Reject it as a bad link.
  const wellFormed =
    !!token &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (token && !wellFormed) {
    status = "not_found";
  } else if (token) {
    const admin = createAdminClient();

    // Two kinds of token reach this page. An account holder carries one on
    // their profile, and unsubscribing means turning the flag off: their row
    // is their account and must survive. Someone who only ever typed their
    // address into the home page form carries the subscribers token, and for
    // them the row is the subscription, so it goes.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("digest_unsubscribe_token", token)
      .maybeSingle();

    if (profileErr) {
      status = "error";
    } else if (profile) {
      const { error: flagErr } = await admin
        .from("profiles")
        .update({ weekly_digest: false, marketing_subscription: false })
        .eq("id", (profile as { id: string }).id);
      status = flagErr ? "error" : "success";
    } else {
      const { data: sub, error: fetchErr } = await admin
        .from("subscribers")
        .select("email")
        .eq("unsubscribe_token", token)
        .maybeSingle();

      if (fetchErr) {
        status = "error";
      } else if (!sub) {
        status = "not_found";
      } else {
        const { error: deleteErr } = await admin
          .from("subscribers")
          .delete()
          .eq("unsubscribe_token", token);
        status = deleteErr ? "error" : "success";
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {status === "success" ? "Unsubscribed" : "Unsubscribe"}
          </h1>

          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              You&apos;ve been removed from the weekly digest. You won&apos;t receive any further emails.
            </p>
          )}

          {status === "missing" && (
            <p className="text-sm text-muted-foreground">
              No unsubscribe token provided. Please use the unsubscribe link from your digest email.
            </p>
          )}

          {status === "not_found" && (
            <p className="text-sm text-muted-foreground">
              This unsubscribe link is invalid or has already been used.
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              Something went wrong. Please try again or contact us at{" "}
              <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
                hello@patronage.nz
              </a>
              .
            </p>
          )}
        </div>

        <Link
          href="/"
          className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          ← Back to Patronage
        </Link>
      </div>
    </div>
  );
}
