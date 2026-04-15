const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export interface TemplateVars {
  recipientName: string;
  opportunityTitle: string;
  claimUrl: string;
}

export function buildClaimOnlyBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

My name's Blake. I'm an artist and the founder of Patronage, a career infrastructure platform for New Zealand creatives.

Your ${vars.opportunityTitle} is already live on our directory to help drive visibility. Listing opportunities on Patronage is always completely free.

Claim your listing here:
${vars.claimUrl}

Feel free to get in touch if you have any questions.

patronage.nz/partners
Blake Aitken · patronage.nz/blakeaitken · +64 27 536 4850`;
}

export function buildClaimPipelineBody(vars: TemplateVars): string {
  return `Kia ora ${vars.recipientName},

My name's Blake. I'm an artist and the founder of Patronage, a career infrastructure platform for New Zealand creatives.

Your ${vars.opportunityTitle} is already live on our directory to help drive visibility. Listing opportunities on Patronage is always completely free. Claim your listing and open your free Partner account here:

${vars.claimUrl}

I noticed your submission process currently runs through manual channels. That administrative friction — downloading forms, organising folders, matching emails to applications — is exactly what our Pipeline tool was built to address.

For now, all you need to do is claim your listing. But when you're ready to streamline applications, you can run your next round through our Pipeline dashboard completely free of charge. Artists apply with one click — CVs, portfolios, and answers to your questions arrive standardised in one secure dashboard.

Feel free to claim the listing today, and keep us in mind for your next round.

patronage.nz/partners
Blake Aitken · patronage.nz/blakeaitken · +64 27 536 4850`;
}

export function buildTemplateSubject(
  template: "claim_only" | "claim_pipeline",
  opportunityTitle: string
): string {
  if (template === "claim_only") {
    return `${opportunityTitle} is live on Patronage`;
  }
  return `${opportunityTitle} is live on Patronage — streamline your next round`;
}

export function buildClaimUrl(token: string): string {
  return `${SITE_URL}/claim-listing/${token}`;
}
