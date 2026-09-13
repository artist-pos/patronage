import Link from "next/link";
import { verifyEmailToken } from "@/lib/email-verification";
import { sendWelcomeDigest } from "@/lib/digest-send";

export const metadata = { title: "Email Confirmed — Patronage" };

interface Props {
  params: Promise<{ token: string }>;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export default async function VerifyTokenPage({ params }: Props) {
  const { token } = await params;
  const { status, profile } = await verifyEmailToken(token);

  if (status === "invalid") {
    return (
      <Shell title="That link didn't work">
        <p className="text-sm text-muted-foreground leading-relaxed">
          It may have already been used, or replaced by a newer one. Sign in and
          you&rsquo;ll find a fresh link waiting in the banner at the top of the
          page.
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
        >
          Sign in
        </Link>
      </Shell>
    );
  }

  // First send of the digest waits until here: mailing an unproved address
  // risks a bounce, and bounces cost the sender reputation every later digest
  // depends on. Fire-and-forget, per convention.
  if (status === "verified" && profile?.email) {
    const isArtist = profile.role === "artist" || profile.role === "owner";
    if (isArtist && profile.weekly_digest) {
      sendWelcomeDigest(profile.email.toLowerCase().trim()).catch(console.error);
    }
  }

  return (
    <Shell title={status === "verified" ? "Email confirmed" : "Already confirmed"}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {status === "verified"
          ? "You can now apply for opportunities, and your weekly digest is active."
          : "This address was already confirmed. Nothing more to do."}
      </p>
      <Link
        href="/opportunities?tab=for-you"
        className="inline-block text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity"
      >
        See opportunities for you
      </Link>
    </Shell>
  );
}
