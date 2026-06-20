import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyEmail, resendConfirmation } from "./actions";

export const metadata = { title: "Confirm Your Email — Patronage" };

interface Props {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    role?: string;
    next?: string;
    code?: string;
    status?: string;
    resend?: string;
  }>;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export default async function ConfirmPage({ searchParams }: Props) {
  const sp = await searchParams;

  // Legacy/PKCE fallback: if the confirmation email still uses the default
  // ConfirmationURL, Supabase redirects here with ?code=. Hand it to the
  // existing callback, which exchanges the code and routes by role/next.
  if (sp.code) {
    const params = new URLSearchParams({ code: sp.code });
    if (sp.role) params.set("role", sp.role);
    if (sp.next) params.set("next", sp.next);
    redirect(`/auth/callback?${params.toString()}`);
  }

  const isExpired = sp.status === "expired" || sp.status === "invalid";
  const hasToken = !!sp.token_hash && !!sp.type;

  // Expired/invalid/missing token → offer a fresh link instead of a dead end.
  if (!hasToken || isExpired) {
    return (
      <Shell title="Link expired">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This confirmation link is invalid or has expired. Enter your email and
          we&rsquo;ll send a fresh one.
        </p>
        <form action={resendConfirmation} className="space-y-3">
          {sp.role && <input type="hidden" name="role" value={sp.role} />}
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
          />
          {sp.resend === "invalid-email" && (
            <p className="text-xs text-destructive">Enter a valid email address.</p>
          )}
          {sp.resend === "error" && (
            <p className="text-xs text-destructive">
              Couldn&rsquo;t resend just now. Please try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
          >
            Resend confirmation email
          </button>
        </form>
        <p className="text-xs text-muted-foreground">
          Already verified?{" "}
          <Link href="/auth/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </Shell>
    );
  }

  // Valid token — verify only on an explicit click so email prefetchers/scanners
  // can't consume the single-use token before the human gets here.
  return (
    <Shell title="Confirm your email">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Click below to verify your email address and continue setting up your
        account.
      </p>
      <form action={verifyEmail}>
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <input type="hidden" name="type" value={sp.type} />
        {sp.role && <input type="hidden" name="role" value={sp.role} />}
        {sp.next && <input type="hidden" name="next" value={sp.next} />}
        <button
          type="submit"
          className="w-full text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
        >
          Confirm email
        </button>
      </form>
    </Shell>
  );
}
