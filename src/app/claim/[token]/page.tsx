import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimEntity } from "./actions";
import { ShadowClaimForm } from "./ShadowClaimForm";
import { isShadowEmail } from "@/lib/shadow";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // ── Entity claim (partner/artist profile) ────────────────────────────────
  const { data: entityToken } = await admin
    .from("claim_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (entityToken) {
    const isExpired =
      entityToken.status === "expired" ||
      (entityToken.expires_at && new Date(entityToken.expires_at) < new Date());

    if (isExpired) {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Link expired</p>
          <p className="text-sm text-muted-foreground">
            This claim link has expired. Contact{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>{" "}
            to request a new one.
          </p>
        </div>
      );
    }

    if (entityToken.status === "claimed") {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Already claimed</p>
          <p className="text-sm text-muted-foreground">This profile has already been claimed.</p>
          <Link href="/auth/login" className="text-sm underline underline-offset-2">Sign in →</Link>
        </div>
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, username, role, account_status, org_category, region_id, regions(name), avatar_url, featured_image_url, banner_focus_y, bio")
      .eq("id", entityToken.entity_id)
      .single();

    // Profiles made by admin are owned by a placeholder login. Those are
    // claimed by choosing an email and password, not by signing up separately.
    const { data: shadowAuth } =
      profile?.account_status === "shadow"
        ? await admin.auth.admin.getUserById(entityToken.entity_id)
        : { data: null };
    const isPlaceholder = isShadowEmail(shadowAuth?.user?.email);

    let opportunityCount = 0;
    if (entityToken.entity_type === "partner" && profile) {
      const { count } = await admin
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id);
      opportunityCount = count ?? 0;
    }

    // A regional arts org anchors its region's page, so the artists already
    // working there are attached to it before it is claimed. Show that.
    let regionArtistCount = 0;
    const regionRel = profile?.regions as { name: string } | { name: string }[] | null | undefined;
    const regionName = Array.isArray(regionRel) ? regionRel[0]?.name : regionRel?.name;
    if (
      entityToken.entity_type === "partner" &&
      profile?.org_category === "regional_arts_org" &&
      profile.region_id
    ) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("region_id", profile.region_id)
        .eq("is_active", true)
        .in("role", ["artist", "owner"]);
      regionArtistCount = count ?? 0;
    }

    const entityLabel = profile?.full_name ?? entityToken.recipient_name ?? "your organisation";
    const entityTypeLabel = entityToken.entity_type === "partner" ? "organisation" : "artist profile";

    const { data: { user } } = await supabase.auth.getUser();

    if (user && isPlaceholder) {
      return (
        <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-sm font-semibold">Sign out to claim this profile</p>
          <p className="text-sm text-muted-foreground">
            {entityLabel} is claimed by choosing the email and password it will sign in with, so this link
            needs to be opened while signed out. If you would rather attach it to your existing account,
            email{" "}
            <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>.
          </p>
        </div>
      );
    }

    if (user) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const expectedRole = entityToken.entity_type === "partner" ? "partner" : "artist";
      if (userProfile?.role !== expectedRole && userProfile?.role !== "admin" && userProfile?.role !== "owner") {
        return (
          <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
            <p className="text-sm font-semibold">Wrong account type</p>
            <p className="text-sm text-muted-foreground">
              This link is for a {entityToken.entity_type} account. Your account is a <strong>{userProfile?.role}</strong> account.
              Contact{" "}
              <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>{" "}
              for help.
            </p>
          </div>
        );
      }

      const result = await claimEntity(token, user.id);
      if (result.error) {
        return (
          <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
            <p className="text-sm font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </div>
        );
      }
      redirect(result.redirectTo ?? "/dashboard");
    }

    const claimPath = `/claim/${token}`;
    const signupHref = `/auth/signup?role=${entityToken.entity_type}&next=${encodeURIComponent(claimPath)}`;
    const signinHref = `/auth/login?next=${encodeURIComponent(claimPath)}`;

    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-black text-white px-6 py-6 space-y-4">
          <p className="text-base font-semibold leading-snug">
            {entityToken.entity_type === "partner"
              ? `${entityLabel}, Patronage has created a profile for your organisation. Claim it to manage your presence and connect with NZ artists.`
              : `${entityLabel}, Patronage has created an artist profile for you. Claim it to take ownership and complete your profile.`}
          </p>
          {entityToken.entity_type === "partner" && opportunityCount > 0 && (
            <p className="text-sm text-white/70">
              {opportunityCount} opportunity listing{opportunityCount !== 1 ? "s" : ""} already attached to your profile.
            </p>
          )}
          {regionArtistCount > 0 && regionName && (
            <p className="text-sm text-white/70">
              {regionArtistCount} artist{regionArtistCount !== 1 ? "s" : ""} in {regionName} {regionArtistCount !== 1 ? "are" : "is"} already on Patronage and appear on your region&apos;s page.
            </p>
          )}
          {isPlaceholder && (
            <p className="text-sm text-white/70">Set up your login below to take it over.</p>
          )}
          <div className={isPlaceholder ? "hidden" : "flex flex-col sm:flex-row gap-2"}>
            <Link href={signupHref} className="inline-block bg-white text-black text-sm font-semibold px-5 py-2.5 text-center hover:bg-stone-100 transition-colors">
              Claim {entityTypeLabel} →
            </Link>
            <Link href={signinHref} className="inline-block border border-white/40 text-white text-sm px-5 py-2.5 text-center hover:border-white transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        {/* What they are taking over, as it looks today. The page it links to is
            public, so it opens without an account. */}
        <div className="border border-border">
          <p className="px-5 pt-4 text-xs font-medium uppercase tracking-widest text-stone-400">You are claiming</p>
          <div className="mt-3 h-[110px] w-full overflow-hidden bg-stone-100">
            {profile?.featured_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.featured_image_url}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
              />
            ) : (
              <div className="h-full w-full" style={{ background: "linear-gradient(135deg,#0d1b1a,#123330 60%,#1a4a44)" }} />
            )}
          </div>
          <div className="space-y-3 px-5 pb-5">
            <div className="-mt-7 flex items-end gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-white">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold">{entityLabel.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 pb-0.5">
                <p className="truncate text-xl font-semibold leading-tight">{entityLabel}</p>
                <p className="text-sm text-muted-foreground capitalize">{entityTypeLabel} on Patronage</p>
              </div>
            </div>
            {profile?.bio && (
              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
            )}
            {entityToken.entity_type === "partner" && opportunityCount > 0 && (
              <p className="text-sm text-muted-foreground">Includes {opportunityCount} opportunity listing{opportunityCount !== 1 ? "s" : ""}</p>
            )}
            {profile?.username && (
              <Link
                href={`/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-medium underline underline-offset-2"
              >
                View the full profile →
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">What happens when you claim</p>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            {entityToken.entity_type === "partner" ? (
              <>
                <li>→ You take ownership of the {entityLabel} listing on Patronage</li>
                <li>→ Edit your organisation description, logo, and contact details</li>
                <li>→ Manage your opportunity listings and applications</li>
              </>
            ) : (
              <>
                <li>→ You take ownership of this artist profile</li>
                <li>→ Edit your bio, portfolio, and contact details</li>
                <li>→ Connect with grants, residencies, and commissions</li>
              </>
            )}
          </ul>
        </div>

        <div className="border-t border-border pt-6 space-y-3">
          {isPlaceholder && (
            <ShadowClaimForm
              token={token}
              defaultEmail={entityToken.recipient_email ?? ""}
              label={entityLabel}
            />
          )}
          <div className={isPlaceholder ? "hidden" : "flex flex-col sm:flex-row gap-2"}>
            <Link href={signupHref} className="inline-block bg-black text-white text-sm font-semibold px-5 py-2.5 text-center hover:bg-black/80 transition-colors">
              Claim {entityTypeLabel} →
            </Link>
            <Link href={signinHref} className="inline-block border border-black text-sm px-5 py-2.5 text-center hover:bg-muted transition-colors">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Questions? <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Provenance link claim (artwork collection) ────────────────────────────

  // Look up provenance link by claim token
  const { data: link } = await admin
    .from("provenance_links")
    .select("id, artwork_id, artist_id, patron_id, patron_email, status")
    .eq("claim_token", token)
    .single();

  if (!link) notFound();

  // Fetch artwork + artist for display
  const [{ data: artwork }, { data: artistProfile }] = await Promise.all([
    admin.from("artworks").select("url, caption, collection_label").eq("id", link.artwork_id).single(),
    admin.from("profiles").select("full_name, username").eq("id", link.artist_id).single(),
  ]);

  if (!artwork) notFound();

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "An artist";
  const workTitle = artwork.caption ?? "Untitled";

  // Check if already processed
  if (link.status === "verified") {
    return (
      <div className="max-w-sm mx-auto px-6 py-20 text-center space-y-4">
        <p className="text-sm font-semibold">Already claimed</p>
        <p className="text-sm text-muted-foreground">This artwork has already been verified in a collection.</p>
        <Link href="/" className="text-sm underline underline-offset-2">Go to Patronage →</Link>
      </div>
    );
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Process the claim — update the provenance link and ensure the work is
    // visible in the buyer's collection dashboard.
    await admin
      .from("provenance_links")
      .update({ patron_id: user.id, patron_email: null, status: "pending" })
      .eq("id", link.id);

    // Upsert collection_membership so the work shows up immediately. Uses
    // ignoreDuplicates so re-claiming (e.g. signing in on a second device)
    // is a no-op rather than an error.
    const { data: lastPosition } = await admin
      .from("collection_membership")
      .select("position")
      .eq("holder_id", user.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    await admin.from("collection_membership").upsert(
      {
        holder_id: user.id,
        artwork_id: link.artwork_id,
        position: (lastPosition?.position ?? -1) + 1,
        source_type: "directly_from_artist",
      },
      { onConflict: "holder_id,artwork_id", ignoreDuplicates: true },
    );

    redirect("/dashboard/collection");
  }

  // Not logged in — show claim landing page
  const claimPath = `/claim/${token}`;

  return (
    <div className="max-w-sm mx-auto px-6 py-20 space-y-8">
      {/* Artwork preview */}
      <div className="border border-black overflow-hidden">
        <div className="relative w-full aspect-square bg-muted">
          <Image
            src={artwork.url}
            alt={workTitle}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
        <div className="px-4 py-3 border-t border-black">
          <p className="text-xs text-muted-foreground">
            {artwork.collection_label ?? "In collection"}
          </p>
          <p className="text-sm font-semibold">{workTitle}</p>
          <p className="text-xs text-muted-foreground">by {artistName}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <h1 className="text-base font-semibold">
          {artistName} has added this work to your collection on Patronage
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create a free account or sign in to confirm this work is in your collection and have it displayed on your profile.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={`/auth/signup?next=${encodeURIComponent(claimPath)}`}
            className="w-full bg-black text-white text-sm py-2.5 px-4 text-center hover:opacity-80 transition-opacity"
          >
            Create account →
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
