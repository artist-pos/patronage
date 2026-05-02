export const metadata = {
  title: "Terms of Service — Patronage",
  description: "Terms of Service for Patronage.",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: May 2026</p>
      </header>

      <Section title="1. Who We Are">
        <p>
          Patronage is a discovery platform connecting artists with patrons, partners, and
          opportunities in Aotearoa New Zealand and beyond. We provide the space — the
          relationships formed here belong to you.
        </p>
      </Section>

      <Section title="2. User Roles">
        <p>Access and permissions vary by role:</p>
        <ul className="mt-3 space-y-2">
          <Item label="Artists">
            Control their own portfolio, bio, available works, and support tiers. Artists
            can receive enquiries from patrons and reply to messages, but cannot initiate
            conversations. Artists can apply to opportunities listed on the platform.
          </Item>
          <Item label="Patrons">
            Can browse artist profiles, send enquiries about available works, purchase works
            or support tiers through Patronage&rsquo;s payment system, and build a collection.
          </Item>
          <Item label="Partners">
            Can submit opportunities for review and browse the verified artist directory.
            Partners may list standard, featured, or pipeline-enabled opportunities and manage
            applications through the partner dashboard.
          </Item>
        </ul>
        <p className="mt-4">
          All accounts are subject to review. We reserve the right to change or remove access
          at any time.
        </p>
      </Section>

      <Section title="3. Ownership & Copyright">
        <p>
          Artists retain 100% ownership and copyright of all images and content they upload
          to Patronage. By uploading, you grant us a limited, non-exclusive licence to display
          your work on the platform. We will never sell, license, or redistribute your work
          to third parties without your explicit consent.
        </p>
        <p className="mt-3">
          Do not upload work you do not own or have the right to display.
        </p>
      </Section>

      <Section title="4. Commerce & Payments">
        <p>
          Patronage facilitates the purchase of artworks, artist support tiers, and partner
          services directly through the platform. All on-platform payments are processed by
          Stripe. By completing a purchase you agree to Stripe&rsquo;s{" "}
          <a
            href="https://stripe.com/nz/legal/consumer"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            terms of service
          </a>
          .
        </p>

        <p className="mt-3">
          <strong>Artwork purchases.</strong> When you purchase an artwork through Patronage,
          you pay the listed sticker price plus a card processing fee (2.9% + NZ$0.30, passed
          through at cost). Patronage retains a 10% platform commission from the seller&rsquo;s
          proceeds. On resales, a 5% royalty is collected and remitted to the original artist.
          A verified provenance certificate is issued to the buyer on completion.
        </p>

        <p className="mt-3">
          <strong>Artist support tiers.</strong> Patrons can support artists through one-off
          or recurring monthly payments. Patronage retains a 5% commission; the artist
          receives the remaining 95% of the tier price. The card processing fee is added on
          top and disclosed in full before checkout.
        </p>

        <p className="mt-3">
          <strong>Partner listings.</strong> Standard listings are free. Featured placements
          and Pipeline activations carry published fees payable via Stripe, with card
          processing costs disclosed at checkout.
        </p>

        <p className="mt-3">
          <strong>Off-platform arrangements.</strong> Any financial agreement reached outside
          of Patronage&rsquo;s payment system is solely between the parties involved. Patronage
          does not guarantee, mediate, or accept liability for off-platform transactions.
        </p>

        <p className="mt-3">
          <strong>Refunds.</strong> Refunds are handled case-by-case. Contact{" "}
          <a
            href="mailto:hello@patronage.nz"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            hello@patronage.nz
          </a>{" "}
          within 14 days of purchase. Refunds on completed artwork transfers may not be
          possible where the provenance certificate has already been issued.
        </p>
      </Section>

      <Section title="5. Conduct">
        <p>By using Patronage, you agree not to:</p>
        <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted-foreground">
          <li>Send unsolicited commercial messages (spam) to other users</li>
          <li>Scrape, harvest, or use artist contact details or profile data for commercial purposes without consent</li>
          <li>Impersonate another person or misrepresent your identity or role</li>
          <li>Upload content that is unlawful, defamatory, or infringes a third party&rsquo;s rights</li>
          <li>Attempt to circumvent any security or access controls on the platform</li>
          <li>Generate, upload, or distribute AI-generated work represented as original human-created art</li>
        </ul>
      </Section>

      <Section title="6. Aggregated Content">
        <p>
          Patronage aggregates arts opportunities from third-party sources. These listings
          link to the original source and we do not claim ownership of third-party content.
          Accuracy is not guaranteed — always check the original listing before applying or
          making decisions based on the information shown.
        </p>
      </Section>

      <Section title="7. Analytics & Engagement Data">
        <p>
          We collect anonymised engagement data on public works — such as view and play
          counts. This data is visible to the artist who owns the work and may be included
          in aggregated platform reporting. It is never sold or shared individually with
          third parties.
        </p>
      </Section>

      <Section title="8. Waitlist & Notification Emails">
        <p>
          If you provide your email through a waitlist or notification form without creating
          an account, we store it only to notify you as requested. You can unsubscribe at
          any time by following the link in any email we send you.
        </p>
      </Section>

      <Section title="9. Partner Opportunity Data">
        <p>
          When applying for partner-funded opportunities, some application questions may be
          set by the funding partner. Your responses to those questions may be shared with
          the partner for the purpose of evaluating your application and for aggregated
          impact reporting.
        </p>
        <p className="mt-3">
          Before submitting an application you will be shown which organisation is running
          the opportunity and what data will be shared with them. By submitting, you consent
          to that data being shared with the named partner for the stated purpose. Partners
          are contractually prohibited from using individual application data for direct
          marketing unless you separately opt in.
        </p>
      </Section>

      <Section title="10. Collective Accounts">
        <p>
          Artists can create collective accounts to represent a group practice. The admin of
          a collective account is responsible for all content and activity posted under that
          account.
        </p>
      </Section>

      <Section title="11. Changes">
        <p>
          We may update these terms from time to time. Continued use of the platform after
          changes are posted constitutes acceptance of the revised terms. Significant changes
          will be communicated via email where possible.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these terms?{" "}
          <a
            href="mailto:hello@patronage.nz"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            hello@patronage.nz
          </a>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-8">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[6rem_1fr] gap-3 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}
