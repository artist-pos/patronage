import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimListing } from "./actions";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimListingPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, organiser, type, featured_image_url, status, profile_id, claim_token_expires_at")
    .eq("claim_token", token)
    .single();

  if (!opp) notFound();

  const isExpired = opp.claim_token_expires_at
    ? new Date(opp.claim_token_expires_at) < new Date()
    : false;

  if (isExpired) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Link expired</p>
        <p className="text-sm text-muted-foreground">
          This claim link expired after 14 days. Please contact{" "}
          <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
            hello@patronage.nz
          </a>{" "}
          to request a new one.
        </p>
      </div>
    );
  }

  if (opp.profile_id) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Already claimed</p>
        <p className="text-sm text-muted-foreground">
          This listing has already been claimed by an organisation.
        </p>
        <Link href="/auth/login" className="text-sm underline underline-offset-2">
          Sign in →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "partner") {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Wrong account type</p>
          <p className="text-sm text-muted-foreground">
            This link is for partner organisations. Please contact{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">
              hello@patronage.nz
            </a>{" "}
            if you need help.
          </p>
        </div>
      );
    }

    const result = await claimListing(token, user.id);
    if ("error" in result) {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </div>
      );
    }

    redirect(`/partner/opportunities/${result.id}/edit`);
  }

  const claimPath = `/claim-listing/${token}`;
  const heading = `${opp.organiser || "Your organisation"}, this listing is live on Patronage. Create a partner account to manage it.`;

  return (
    <div className="max-w-sm mx-auto px-6 py-20 space-y-8">
      {/* Listing preview card */}
      <div className="border border-black overflow-hidden">
        {opp.featured_image_url && (
          <div className="w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opp.featured_image_url}
              alt={opp.title}
              className="w-full h-40 object-contain"
            />
          </div>
        )}
        <div className="px-4 py-3 border-t border-black/10">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">{opp.type}</p>
          <p className="text-sm font-semibold">{opp.title}</p>
          {opp.organiser && (
            <p className="text-xs text-muted-foreground">{opp.organiser}</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <h1 className="text-base font-semibold leading-snug">{heading}</h1>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={`/auth/signup?role=partner&next=${encodeURIComponent(claimPath)}`}
            className="w-full bg-black text-white text-sm py-2.5 px-4 text-center hover:opacity-80 transition-opacity"
          >
            Create partner account →
          </Link>
          <Link
            href={`/auth/login?next=${encodeURIComponent(claimPath)}`}
            className="w-full border border-border text-sm py-2.5 px-4 text-center hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
