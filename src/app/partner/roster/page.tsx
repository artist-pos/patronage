import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { canKeepRoster, orgCategory } from "@/lib/org-categories";
import { RosterManager, type RosterEntry } from "./RosterManager";
import { InviteUpload } from "./InviteUpload";
import { InviteCopyEditor } from "./InviteCopyEditor";
import { defaultInviteCopy } from "@/lib/email";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artists — Patronage",
  robots: { index: false, follow: false },
};

/**
 * An organisation's artists.
 *
 * Its own space rather than a settings tab, on the same logic as the artist
 * studio: this is the organisation's public-facing content, not a configuration
 * toggle. Settings is where you configure things.
 *
 * Two halves, and they are different jobs. The roster is the consented list that
 * renders on the public page. The invitation tool is acquisition, and any
 * organisation may use it, including a regional arts body that keeps no roster
 * at all.
 */
export default async function PartnerRosterPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login?next=/partner/roster");
  const { data: profileRow } = await supabase
    .from("profiles")
    .select(`id, role, org_category, full_name, username, region_id, regions(name),
            org_invite_subject, org_invite_headline, org_invite_subhead,
            org_invite_message, org_invite_reply_to`)
    .eq("id", user.id)
    .single();

  const profile = profileRow as {
    id: string;
    role: string;
    org_category: string | null;
    full_name: string | null;
    username: string;
    region_id: string | null;
    regions: { name: string } | null;
    org_invite_subject: string | null;
    org_invite_headline: string | null;
    org_invite_subhead: string | null;
    org_invite_message: string | null;
    org_invite_reply_to: string | null;
  } | null;

  if (!profile || (profile.role !== "partner" && profile.role !== "admin")) {
    redirect("/");
  }

  const category = orgCategory(profile.org_category);
  const keepsRoster = canKeepRoster(profile.org_category);
  const isAlumni = category?.hasAlumni ?? false;

  const admin = createAdminClient();

  // The roster, if one has been opened, and the invitation funnel. Independent
  // reads, so they go together.
  const showRegion = profile.org_category === "regional_arts_org" && !!profile.region_id;
  const [{ data: rosterRow }, { data: inviteRows }, { data: regionRows }] = await Promise.all([
    admin
      .from("collectives")
      .select("id, name, relationship, is_public")
      .eq("org_profile_id", profile.id)
      .limit(1)
      .maybeSingle(),
    admin
      .from("artist_invitations")
      .select("status")
      .eq("org_profile_id", profile.id),
    // Everyone working in the region. Already public on the region's page, so
    // this is a convenience view, not a disclosure.
    showRegion
      ? admin
          .from("profiles")
          .select("id, username, full_name, city")
          .eq("region_id", profile.region_id)
          .eq("is_active", true)
          .in("role", ["artist", "owner"])
          .order("full_name", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  const regionArtists = (regionRows ?? []) as Array<{
    id: string;
    username: string;
    full_name: string | null;
    city: string | null;
  }>;

  // Artists who have named this organisation as theirs (189). Their choice, not
  // a claim this organisation gets to make, so it is shown only here and never
  // on anyone's public page.
  const { data: namedByRows } = await admin
    .from("profiles")
    .select("id, username, full_name, city")
    .eq("arts_org_id", profile.id)
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(200);

  const namedBy = (namedByRows ?? []) as Array<{
    id: string;
    username: string;
    full_name: string | null;
    city: string | null;
  }>;

  const roster = rosterRow as {
    id: string;
    name: string;
    relationship: string;
    is_public: boolean;
  } | null;

  const { data: memberRows } = roster
    ? await admin
        .from("collective_members")
        .select(
          "id, user_id, status, start_year, end_year, profiles!collective_members_user_id_fkey(username, full_name, avatar_url, city)"
        )
        .eq("collective_id", roster.id)
        .order("start_year", { ascending: false, nullsFirst: false })
    : { data: [] };

  const entries: RosterEntry[] = (
    (memberRows ?? []) as unknown as Array<{
      id: string;
      user_id: string;
      status: string;
      start_year: number | null;
      end_year: number | null;
      profiles: {
        username: string;
        full_name: string | null;
        avatar_url: string | null;
        city: string | null;
      } | null;
    }>
  ).map((m) => ({
    membershipId: m.id,
    artistId: m.user_id,
    username: m.profiles?.username ?? "",
    fullName: m.profiles?.full_name ?? null,
    avatarUrl: m.profiles?.avatar_url ?? null,
    city: m.profiles?.city ?? null,
    accepted: m.status === "accepted",
    startYear: m.start_year,
    endYear: m.end_year,
  }));

  const invites = (inviteRows ?? []) as Array<{ status: string }>;
  const funnel = {
    invited: invites.filter((i) => i.status !== "existing").length,
    opened: invites.filter((i) => i.status === "opened" || i.status === "joined").length,
    joined: invites.filter((i) => i.status === "joined").length,
    alreadyHere: invites.filter((i) => i.status === "existing").length,
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-12 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em]">
          Artists
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {keepsRoster
            ? isAlumni
              ? "Everyone who has been through your programme, with the years. Each person confirms before they appear on your page."
              : "The artists you represent. Each one confirms before they appear on your page."
            : "Invite the artists you work with onto Patronage. Your organisation does not claim them: they simply get a profile, and appear on their region's page because of where they work."}
        </p>
      </header>

      {keepsRoster && roster && (
        <RosterManager
          entries={entries}
          isAlumni={isAlumni}
          rosterNoun={category?.rosterNoun ?? "artist"}
        />
      )}

      {keepsRoster && !roster && (
        <RosterManager entries={[]} isAlumni={isAlumni} rosterNoun={category?.rosterNoun ?? "artist"} />
      )}

      <section className="space-y-5 border-t border-border pt-10">
        <div className="space-y-2">
          <h2 className="text-[17px] font-semibold leading-[1.3]">
            Invite artists by spreadsheet
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upload a list and each artist receives an invitation from{" "}
            {profile.full_name ?? profile.username}, not from Patronage. You will
            see exactly who is about to be contacted before anything is sent.
          </p>
        </div>

        <InviteCopyEditor
          initial={{
            subject: profile.org_invite_subject ?? "",
            headline: profile.org_invite_headline ?? "",
            subhead: profile.org_invite_subhead ?? "",
            message: profile.org_invite_message ?? "",
            replyTo: profile.org_invite_reply_to ?? "",
          }}
          defaults={defaultInviteCopy({
            orgName: profile.full_name ?? profile.username,
            regionName: profile.regions?.name ?? null,
          })}
        />

        <InviteUpload
          orgName={profile.full_name ?? profile.username}
          regionName={profile.regions?.name ?? null}
        />

        {funnel.invited > 0 && (
          <div className="grid grid-cols-2 gap-[2px] bg-feed-bg sm:grid-cols-4">
            <Stat label="Invited" value={funnel.invited} />
            <Stat label="Opened the link" value={funnel.opened} />
            <Stat label="Created a profile" value={funnel.joined} />
            <Stat label="Already here" value={funnel.alreadyHere} />
          </div>
        )}
      </section>

      {showRegion && regionArtists.length > 0 && (
        <section className="space-y-4 border-t border-border pt-10">
          <div className="space-y-2">
            <h2 className="text-[17px] font-semibold leading-[1.3]">
              {regionArtists.length} artist{regionArtists.length === 1 ? "" : "s"} already in{" "}
              {profile.regions?.name ?? "your region"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Everyone on Patronage who works in your region. They appear on your
              region&apos;s page because of where they are, not because anyone listed them.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {regionArtists.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/${a.username}`}
                  className="text-[14px] transition-colors hover:text-[color:var(--brand)]"
                >
                  {a.full_name ?? a.username}
                </Link>
                {a.city && (
                  <span className="ml-2 font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {a.city}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {namedBy.length > 0 && (
        <section className="space-y-4 border-t border-border pt-10">
          <div className="space-y-2">
            <h2 className="text-[17px] font-semibold leading-[1.3]">
              Artists who name you as their arts organisation
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Their choice, and only you can see it. It does not appear on their
              profile and gives you no claim over them.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {namedBy.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/${a.username}`}
                  className="text-[14px] transition-colors hover:text-[color:var(--brand)]"
                >
                  {a.full_name ?? a.username}
                </Link>
                {a.city && (
                  <span className="ml-2 font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {a.city}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-border pt-6">
        <Link
          href="/partner/dashboard"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-[22px] font-semibold leading-none">{value}</p>
    </div>
  );
}
