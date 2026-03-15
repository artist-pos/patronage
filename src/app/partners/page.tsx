import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpportunitySubmissionForm } from "@/components/partners/OpportunitySubmissionForm";

export const metadata = {
  title: "Partners — Patronage",
  description:
    "List an opportunity or discover verified artists through the Patronage platform.",
};

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let partnerName: string | null = null;
  let role: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, username, role")
      .eq("id", user.id)
      .single();
    partnerName = profile?.full_name ?? profile?.username ?? null;
    role = profile?.role ?? null;
  }

  if (!user || !["partner", "admin", "owner"].includes(role ?? "")) {
    redirect("/auth/login?next=/partners&message=partner-required");
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">

        {/* ── Left: Value proposition ── */}
        <div className="space-y-16">
          <header className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">Partners</h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
              Patronage connects arts organisations, councils, foundations, and
              private patrons with verified New Zealand and Australian artists.
            </p>
          </header>

          <section className="space-y-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Why Patronage
            </h2>

            <div className="space-y-0">
              <ValuePoint
                index="01"
                heading="Verified artist directory"
                body="Every profile is manually reviewed. Partners access a curated pool of working artists — not a self-selected public listing."
              />
              <ValuePoint
                index="02"
                heading="Targeted reach"
                body="Filter by medium, career stage, and location. Your opportunity reaches the artists most likely to apply and succeed."
              />
              <ValuePoint
                index="03"
                heading="Weekly digest"
                body="Active opportunities are distributed to our subscriber list every week. Your listing gets seen, not buried."
              />
              <ValuePoint
                index="04"
                heading="Two business day review"
                body="We review and verify every submission before publishing. Quality control on both sides."
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-black pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Managed Discovery
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Looking for artists rather than advertising to them? Browse the
              verified directory directly — profiles include bios, portfolio
              work, and CVs. For high-volume or recurring discovery, contact us
              about a managed partnership arrangement.
            </p>
            <a
              href="mailto:hello@patronage.nz?subject=Partnership%20Enquiry"
              className="inline-block text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
            >
              Enquire about partnerships →
            </a>
          </section>
        </div>

        {/* ── Right: Submission form or Partner Wall ── */}
        <div className="space-y-6">
          <div className="space-y-1 border-b border-black pb-6">
            <h2 className="text-xl font-semibold tracking-tight">Submit an Opportunity</h2>
            <p className="text-sm text-muted-foreground">
              Fill in the details below. We review every submission within two
              business days before publishing.
            </p>
          </div>

          <OpportunitySubmissionForm isLoggedIn={true} partnerName={partnerName} />
        </div>

      </div>
    </div>
  );
}

function ValuePoint({
  index,
  heading,
  body,
}: {
  index: string;
  heading: string;
  body: string;
}) {
  return (
    <div className="border-t border-black py-5 grid grid-cols-[2rem_1fr] gap-4">
      <span className="font-mono text-xs text-muted-foreground pt-0.5">{index}</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{heading}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
