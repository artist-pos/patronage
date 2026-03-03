export const metadata = {
  title: "Privacy Policy — Patronage",
  description: "Privacy Policy for Patronage.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
      </header>

      <Section title="1. What We Collect">
        <p>We collect only what we need to run the platform:</p>
        <ul className="mt-3 space-y-2.5">
          <Item label="Email address">
            Collected when you sign up via Google Auth or email. Used for login, account
            recovery, and message notifications.
          </Item>
          <Item label="Profile information">
            Name, bio, location, and any portfolio content you choose to add. This is
            voluntary — you control what appears on your profile.
          </Item>
          <Item label="Messages">
            Conversations between users are stored so both parties can access them. We do
            not read private messages except where required to investigate a reported
            conduct violation.
          </Item>
          <Item label="Usage data">
            Basic analytics such as page visits may be collected by our hosting provider
            (Vercel). We do not use third-party advertising trackers.
          </Item>
        </ul>
      </Section>

      <Section title="2. Profile Visibility">
        <p>
          <strong>Artist profiles</strong> are public. Your name, bio, portfolio images,
          available works, and CV are visible to anyone who visits Patronage, including
          search engines.
        </p>
        <p className="mt-3">
          <strong>Patron and Partner profiles</strong> are visible to the Patronage
          community. Your taste profile and followed artists are part of the platform
          experience but are not indexed externally.
        </p>
        <p className="mt-3">
          Your email address is never displayed publicly on any profile.
        </p>
      </Section>

      <Section title="3. Third-Party Services">
        <p>We use the following services to run Patronage:</p>
        <ul className="mt-3 space-y-2.5">
          <Item label="Supabase">
            Our database and authentication provider. User data, profiles, messages, and
            portfolio content are stored on Supabase infrastructure.{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Supabase Privacy Policy
            </a>
          </Item>
          <Item label="Vercel">
            Our hosting provider. Serves the Patronage web application and may collect
            basic request logs.{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Vercel Privacy Policy
            </a>
          </Item>
          <Item label="Resend">
            Used to send transactional emails such as message notifications and digest
            emails. Your email address is passed to Resend only to deliver emails you
            would expect to receive.{" "}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Resend Privacy Policy
            </a>
          </Item>
          <Item label="Google">
            If you sign in with Google, Google authenticates your identity and shares
            your email address with us. We do not receive your Google password.{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Google Privacy Policy
            </a>
          </Item>
        </ul>
      </Section>

      <Section title="4. We Do Not Sell Your Data">
        <p>
          We will never sell, rent, or trade your personal information or artist contact
          details to any third party for commercial purposes. Full stop.
        </p>
      </Section>

      <Section title="5. Data Retention & Deletion">
        <p>
          Your data is retained for as long as your account is active. To request deletion
          of your account and associated data, email us at{" "}
          <a
            href="mailto:hello@patronage.nz"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            hello@patronage.nz
          </a>
          . We will process deletion requests within 30 days.
        </p>
      </Section>

      <Section title="6. Changes">
        <p>
          We may update this policy as the platform evolves. We&rsquo;ll notify users of
          material changes via email. Continued use of Patronage after changes are posted
          means you accept the updated policy.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          Questions or concerns about your privacy?{" "}
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
      <span className="font-medium pt-0.5">{label}</span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}
