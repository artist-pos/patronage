import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invitation not valid",
  robots: { index: false, follow: false },
};

// Where /invite/[token] and /[username]/join send a link that does not resolve.
export default function InvalidInvitePage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          This invitation link is not valid
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been mistyped or already used. You can still create a free
          profile yourself.
        </p>
        <Link
          href="/auth/signup?role=artist"
          className="inline-flex items-center bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Create your profile →
        </Link>
      </div>
    </div>
  );
}
