const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export interface TemplateVars {
  recipientName: string;
  organiserName: string;
  opportunityTitle: string;
  claimUrl: string;
  listingUrl?: string;
}

export function buildClaimOnlyBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

I've added ${vars.organiserName}'s ${vars.opportunityTitle} to Patronage, a platform connecting NZ and Australian creatives with funding opportunities. Creatives are already finding it.

If you'd like to take ownership of the listing, the link below lets you claim it. You'll be able to edit details, update the deadline, and see how many creatives are viewing it. The listing stays live either way.

${vars.claimUrl}

Blake
Patronage · patronage.nz`;
}

export function buildClaimPipelineBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

I've added ${vars.organiserName}'s ${vars.opportunityTitle} to Patronage, a platform connecting NZ and Australian creatives with funding opportunities. Creatives are already finding it.

If you'd like to take ownership of the listing, the link below lets you claim it. You'll be able to edit details, update the deadline, and see how many creatives are viewing it. The listing stays live either way.

${vars.claimUrl}

One other thing: Patronage has a pipeline tool that lets creatives apply directly through the platform. You'd receive applications in a structured dashboard. Shortlist, request assets, download files, instead of managing submissions through email or a form. Happy to set that up at no cost while we're in early access.

Blake
Patronage · patronage.nz`;
}

export function buildTemplateSubject(
  _template: "claim_only" | "claim_pipeline",
  _opportunityTitle: string
): string {
  return "Your opportunity is live on Patronage";
}

export function buildClaimUrl(token: string): string {
  return `${SITE_URL}/claim-listing/${token}`;
}
