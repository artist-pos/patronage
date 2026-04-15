import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unsubscribe — Patronage" };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;

  let status: "success" | "missing" | "not_found" | "error" = "missing";

  if (token) {
    const admin = createAdminClient();
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
