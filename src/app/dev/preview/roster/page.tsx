import { notFound } from "next/navigation";
import { RosterManager, type RosterEntry } from "@/app/partner/roster/RosterManager";
import { InviteUpload } from "@/app/partner/roster/InviteUpload";
import { InviteCopyEditor } from "@/app/partner/roster/InviteCopyEditor";
import { defaultInviteCopy } from "@/lib/email";
import { CvTab } from "@/components/profile/tabs/CvTab";
import { parseInviteCsv, summarise, type InvitePreview, type PreviewRow } from "@/lib/artist-invites";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preview — roster surfaces",
  robots: { index: false, follow: false },
};

/**
 * Design preview for the roster and invitation surfaces.
 *
 * Dev only. These screens sit behind a partner login, so reviewing the layout
 * would otherwise mean creating a gallery account and a spreadsheet first. This
 * renders the real components against fixed data so the design can be looked at
 * directly.
 *
 * Safe to delete. Nothing else imports it.
 */
export default function RosterPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const alumni: RosterEntry[] = [
    entry("hemi-tawhai", "Hemi Tāwhai", "Whangārei", true, 2025, null),
    entry("marama-reid", "Marama Reid", "Auckland", true, 2024, 2024),
    entry("jo-sinclair", "Jo Sinclair", "Hamilton", true, 2022, 2023),
    entry("ana-fuentes", "Ana Fuentes", "Wellington", false, 2021, 2021),
  ];

  const represented: RosterEntry[] = [
    entry("ruby-ngata", "Ruby Ngata", "Auckland", true, null, null),
    entry("theo-blackwood", "Theo Blackwood", "Waiheke Island", true, null, null),
    entry("piper-hall", "Piper Hall", null, false, null, null),
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-16 px-6 py-12">
      <Banner />

      <Block
        title="Residency — participant list, with years"
        note="Years are editable per person. A null end year reads as still there. The bottom group has not confirmed yet, so nothing of theirs renders publicly."
      >
        <RosterManager entries={alumni} isAlumni rosterNoun="participant" />
      </Block>

      <Block
        title="Gallery — represented artists, no years"
        note="Same screen, no year fields, because representation is current rather than dated."
      >
        <RosterManager entries={represented} isAlumni={false} rosterNoun="represented artist" />
      </Block>

      <Block
        title="Empty state"
        note="What a gallery sees before it has invited anyone."
      >
        <RosterManager entries={[]} isAlumni={false} rosterNoun="represented artist" />
      </Block>

      <Block
        title="Bulk invite — editing the wording"
        note="Collapsed by default. Every field is optional, and the placeholder is what sends if it is left blank. The frame around the words is fixed."
      >
        <InviteCopyEditor
          initial={{ subject: "", headline: "", subhead: "", message: "", replyTo: "" }}
          defaults={defaultInviteCopy({ orgName: "Creative Waikato", regionName: "Waikato" })}
        />
      </Block>

      <Block
        title="Bulk invite — the upload control"
        note="Before a file is chosen."
      >
        <InviteUpload orgName="Creative Waikato" regionName="Waikato" />
      </Block>

      <Block
        title="Bulk invite — the confirmation an organisation has to read"
        note="Nothing sends until this is confirmed. Every row is accounted for, including the ones that cannot be used."
      >
        <InviteUpload
          orgName="Creative Waikato"
          regionName="Waikato"
          demoPreview={demoPreview()}
        />
      </Block>

      <Block
        title="Invitation funnel"
        note="Shown under the upload once anything has been sent. This is the number that sells the next regional body on doing the same."
      >
        <div className="grid grid-cols-2 gap-[2px] bg-feed-bg sm:grid-cols-4">
          <Stat label="Invited" value={186} />
          <Stat label="Opened the link" value={94} />
          <Stat label="Created a profile" value={61} />
          <Stat label="Already here" value={12} />
        </div>
      </Block>

      <Block
        title="Artist profile — residencies on the CV"
        note="A dated credit sitting above exhibitions, which is how an artist writes it themselves. Gallery representation is not here: it renders in the profile header under the name."
      >
        <CvTab
          exhibitions={[
            { year: 2025, title: "Tidal Register", venue: "Te Uru", location: "Auckland", type: "Solo" },
            { year: 2023, title: "Soft Ground", venue: "Ramp Gallery", location: "Hamilton", type: "Group" },
          ]}
          bibliography={[]}
          receivedGrants={["Creative New Zealand Quick Response"]}
          achievements={[]}
          cvUrl={null}
          profileId="preview"
          username="preview"
          displayName="Preview Artist"
          participation={[
            { username: "mcculloch-residency", name: "McCulloch Residency", avatarUrl: null, startYear: 2025, endYear: null },
            { username: "parehuia", name: "Parehuia, McCahon House", avatarUrl: null, startYear: 2023, endYear: 2023 },
            { username: "tylee-cottage", name: "Tylee Cottage", avatarUrl: null, startYear: 2020, endYear: 2021 },
          ]}
        />
      </Block>

      <Block
        title="Artist profile header — representation"
        note="The header sits on a dark banner, so this is the line as it appears there. Each gallery links to its own page, which is where a visitor finds the rest of its artists."
      >
        <div className="bg-[#1c1c1c] p-8">
          <h1 className="mb-3 text-[40px] font-semibold leading-[0.94] tracking-[-0.045em] text-white">
            Ruby Ngata
          </h1>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-xs text-white/55">
            <span>Auckland</span>
            <span aria-hidden className="text-white/25">·</span>
            <span className="lowercase">visual art</span>
          </div>
          <p className="mt-2.5 text-[13px] text-white/70">
            Represented by{" "}
            <a href="#" className="text-white underline decoration-white/30 underline-offset-[3px]">
              Anna Miles Gallery
            </a>
            {" and "}
            <a href="#" className="text-white underline decoration-white/30 underline-offset-[3px]">
              Jhana Millers
            </a>
          </p>
        </div>
      </Block>
    </div>
  );
}

function entry(
  username: string,
  fullName: string,
  city: string | null,
  accepted: boolean,
  startYear: number | null,
  endYear: number | null
): RosterEntry {
  return {
    membershipId: username,
    artistId: username,
    username,
    fullName,
    avatarUrl: null,
    city,
    accepted,
    startYear,
    endYear,
  };
}

/** A file with the problems real spreadsheets actually have. */
function demoPreview(): InvitePreview {
  const csv = [
    "Artist Name,E-mail Address,Art Form,Town",
    "Hemi Tāwhai,hemi@example.co.nz,Painting,Hamilton",
    "Marama Reid,marama@example.org,Photography / Film,Raglan",
    '"Sinclair, Jo",jo@example.nz,Ceramics,Te Awamutu',
    "Ana Fuentes,ana@example.com,Sculpture,Cambridge",
    "Tane Roberts,tane@example.co.nz,Sound,Kihikihi",
    "Priya Nair,not-an-email,Textile,Hamilton",
    "Sam Ellery,,Printmaking,Morrinsville",
    "Duplicate Person,hemi@example.co.nz,Painting,Hamilton",
    "Kate Oliver,kate@example.nz,Architecture,Hamilton",
  ].join("\n");

  const parsed = parseInviteCsv(csv);

  // Two of the valid rows stand in for people who already have accounts, which
  // is the case an organisation most needs to see before it sends.
  const rows: PreviewRow[] = parsed.rows.map((r, i) => {
    if (r.problem) return { ...r, outcome: "invalid" as const };
    if (i === 1) return { ...r, outcome: "existing" as const, existingUsername: "maramareid" };
    if (i === 3) return { ...r, outcome: "existing" as const, existingUsername: "anafuentes" };
    return { ...r, outcome: "invite" as const };
  });

  return {
    rows,
    counts: summarise(rows),
    total: rows.length,
    columns: parsed.columns,
    error: null,
  };
}

function Banner() {
  return (
    <div className="border border-border bg-[color:var(--brand-sub)] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
        Design preview
      </p>
      <p className="mt-1 text-sm">
        Real components, fixed data, no database. This route does not exist in
        production.
      </p>
    </div>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border pb-3">
        <h2 className="text-[17px] font-semibold leading-[1.3]">{title}</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-[color:var(--fg-muted)]">{note}</p>
      </div>
      {children}
    </section>
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
