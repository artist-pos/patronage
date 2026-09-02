"use client";

import { useState, useTransition } from "react";
import { updatePartnerOrgFields } from "@/app/onboarding/partner-actions";
import type { OrganisationType, Profile } from "@/types/database";

interface Props {
  profile: Pick<
    Profile,
    | "organisation_type"
    | "charitable_registration"
    | "donation_url"
    | "donation_enabled"
  >;
}

const ORG_OPTIONS: { value: OrganisationType; label: string; hint: string }[] = [
  {
    value: "charity",
    label: "Charity / Foundation",
    hint: "Registered charities and arts foundations. Unlocks an admin-gated donation CTA on your profile.",
  },
  {
    value: "gallery",
    label: "Gallery / Institution",
    hint: "Galleries, museums, artist-run spaces.",
  },
  {
    value: "business",
    label: "Business / Corporate",
    hint: "Corporates, developers, and ESG-led organisations engaging with the arts.",
  },
];

/**
 * Partner-side controls for organisation type + donation request fields.
 * Charities fill charitable_registration + donation_url then submit; admin
 * flips donation_enabled once they've verified the registration number.
 */
export function PartnerOrgFields({ profile }: Props) {
  const [orgType, setOrgType] = useState<OrganisationType | "">(profile.organisation_type ?? "");
  const [registration, setRegistration] = useState(profile.charitable_registration ?? "");
  const [donationUrl, setDonationUrl] = useState(profile.donation_url ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCharity = orgType === "charity";

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePartnerOrgFields({
        organisationType: (orgType || null) as OrganisationType | null,
        charitableRegistration: registration,
        donationUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-5 border border-stone-200 rounded-xl p-6"
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Organisation
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Tells visitors what kind of organisation you are and unlocks the
          right CTAs on your profile.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs text-muted-foreground">Organisation type</legend>
        {ORG_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="orgType"
              value={opt.value}
              checked={orgType === opt.value}
              onChange={() => setOrgType(opt.value)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium">{opt.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {opt.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {isCharity && (
        <div className="space-y-4 border-l-2 border-stone-200 pl-4">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              Charities Commission registration number (NZ) or equivalent
            </span>
            <input
              type="text"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              placeholder="CC12345"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              Off-site donation URL
            </span>
            <input
              type="url"
              value={donationUrl}
              onChange={(e) => setDonationUrl(e.target.value)}
              placeholder="https://example.org/donate"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {profile.donation_enabled
              ? "Approved. Your donation CTA is live on your profile."
              : "Patronage will verify the registration number, then enable the donation CTA on your profile. Patronage doesn't process donations directly."}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 justify-end">
        {savedAt && <span className="text-xs text-emerald-700">Saved.</span>}
        <button
          type="submit"
          disabled={isPending}
          className="bg-foreground text-background text-sm rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
