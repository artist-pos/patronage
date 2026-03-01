import { PartnerCTA } from "@/components/partners/PartnerCTA";

export const metadata = {
  title: "For Partners — Patronage",
  description:
    "List an opportunity or discover verified artists through the Patronage platform.",
};

export default function PartnersPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 space-y-20">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">For Partners</h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
          Patronage works with arts organisations, councils, foundations, and
          private patrons to connect opportunities with the artists who need
          them most.
        </p>
      </header>

      {/* Section 1 — List an Opportunity */}
      <section className="space-y-6 border-t border-border pt-12">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            List an Opportunity
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            We accept listings for grants, residencies, commissions, open calls,
            prizes, and display opportunities open to artists based in New
            Zealand or Australia.
          </p>
        </div>
        <ul className="text-sm space-y-2 text-foreground">
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">01</span>
            <span>Send us your opportunity details — title, organiser, deadline, eligibility, and a link.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">02</span>
            <span>We review and verify the listing within two business days.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">03</span>
            <span>Your listing appears on the board, visible to all registered artists and visitors.</span>
          </li>
        </ul>
        <PartnerCTA
          label="Submit an Opportunity"
          subject="Opportunity Submission"
          body="Organisation / Funder name:
Opportunity title:
Type (Grant / Residency / Commission / Open Call / Prize / Display):
Deadline:
Eligibility notes:
URL:"
        />
      </section>

      {/* Section 2 — Managed Submissions */}
      <section className="space-y-6 border-t border-border pt-12">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Managed Submissions
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
            Looking for artists rather than advertising to them? Our curated
            directory lets you search verified artist profiles by medium, career
            stage, and location — then reach out directly.
          </p>
        </div>
        <ul className="text-sm space-y-2 text-foreground">
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">01</span>
            <span>Browse the Patronage artist directory — profiles include bios, portfolios, and CVs.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">02</span>
            <span>All listed artists have opted in to being contacted by partners.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground select-none">03</span>
            <span>For high-volume or recurring discovery, contact us about a managed partnership arrangement.</span>
          </li>
        </ul>
        <PartnerCTA
          label="Enquire About Partnerships"
          subject="Partnership Enquiry"
          body="Organisation / Company name:
What you are looking for:
Timeline:"
        />
      </section>
    </div>
  );
}
