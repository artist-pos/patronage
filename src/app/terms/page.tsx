export const metadata = {
  title: "Terms of Service — Patronage",
  description: "Terms of Service for Patronage.",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
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
            Control their own portfolio, bio, and available works. Artists can receive
            enquiries from patrons and reply to messages, but cannot initiate conversations.
          </Item>
          <Item label="Patrons">
            Can browse artist profiles, follow artists, send enquiries about available works,
            and build a personal taste profile.
          </Item>
          <Item label="Partners">
            Can submit opportunities for review and browse the verified artist directory.
            Partners may also send enquiries to artists.
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

      <Section title="4. Transactions">
        <p>
          Patronage is a discovery platform, not an escrow or payment service. Any sales,
          commissions, or financial agreements negotiated through our messaging system are
          private arrangements between the individuals involved. We are not a party to those
          transactions and accept no liability for disputes arising from them.
        </p>
        <p className="mt-3">
          We strongly encourage both parties to agree on terms in writing before exchanging
          funds or artwork.
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
        </ul>
      </Section>

      <Section title="6. Changes">
        <p>
          We may update these terms from time to time. Continued use of the platform after
          changes are posted constitutes acceptance of the revised terms. Significant changes
          will be communicated via email where possible.
        </p>
      </Section>

      <Section title="7. Contact">
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
