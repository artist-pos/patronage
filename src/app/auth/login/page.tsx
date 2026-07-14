import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { ExpiredLinkNotice } from "@/components/auth/ExpiredLinkNotice";

export const metadata = { title: "Sign In — Patronage" };

interface Props {
  searchParams: Promise<{ next?: string; error?: string; message?: string; role?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error, message, role } = await searchParams;
  const signupHref = `/auth/signup${
    next || role
      ? `?${[
          next ? `next=${encodeURIComponent(next)}` : "",
          role ? `role=${encodeURIComponent(role)}` : "",
        ]
          .filter(Boolean)
          .join("&")}`
      : ""
  }`;
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link href={signupHref} className="underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </div>
        {message === "partner-required" && (
          <p className="text-xs text-muted-foreground border border-black px-3 py-2 bg-muted">
            You need a partner account to list opportunities.
          </p>
        )}
        {message === "confirm-sent" && (
          <p className="text-xs text-muted-foreground border border-black px-3 py-2 bg-muted">
            Confirmation email sent. Check your inbox (and spam) for the link.
          </p>
        )}
        {message === "already-confirmed" && (
          <p className="text-xs text-muted-foreground border border-black px-3 py-2 bg-muted">
            Your email is already confirmed — sign in below.
          </p>
        )}
        {error === "callback" && (
          <div className="text-xs text-destructive space-y-1">
            <p>
              That link didn&rsquo;t work — it may have expired or been opened on a
              different device.
            </p>
            <Link href="/auth/confirm?status=expired" className="underline underline-offset-2">
              Resend confirmation email →
            </Link>
          </div>
        )}
        <ExpiredLinkNotice />
        <AuthForm mode="login" next={next ?? "/profile/edit"} />
      </div>
    </div>
  );
}
