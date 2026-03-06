import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Unsubscribe — Patronage" };

interface Props {
  searchParams: Promise<{ email?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { email } = await searchParams;

  let status: "success" | "missing" | "error" = "missing";

  if (email) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("subscribers")
      .delete()
      .eq("email", email.toLowerCase().trim());

    status = error ? "error" : "success";
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
              {email} has been removed from the weekly digest. You won&apos;t receive any further emails.
            </p>
          )}

          {status === "missing" && (
            <p className="text-sm text-muted-foreground">
              No email address provided. Please use the unsubscribe link from your digest email.
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
