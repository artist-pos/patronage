/**
 * Guess how an organisation takes applications today, from where their apply
 * link points. A suggestion for the claim-outreach details, never saved without
 * a person confirming it.
 */
const TOOLS: Array<{ tool: string; pattern: RegExp }> = [
  { tool: "Google Form", pattern: /(docs\.google\.com\/forms|forms\.gle)/i },
  { tool: "Jotform", pattern: /jotform\.com/i },
  { tool: "Submittable", pattern: /submittable\.com/i },
  { tool: "SmartyGrants", pattern: /smartygrants\.com/i },
  { tool: "Typeform", pattern: /typeform\.com/i },
  { tool: "Airtable", pattern: /airtable\.com/i },
  { tool: "SurveyMonkey", pattern: /surveymonkey\.com/i },
  { tool: "Formstack", pattern: /formstack\.com/i },
  { tool: "Microsoft Forms", pattern: /(forms\.office\.com|forms\.microsoft\.com)/i },
  { tool: "Cognito Forms", pattern: /cognitoforms\.com/i },
  { tool: "SlideRoom", pattern: /slideroom\.com/i },
  { tool: "Eventbrite", pattern: /eventbrite\./i },
];

/**
 * @param applicationUrl  the apply link, if the page has one
 * @param pageContent     the page's HTML or text; used to spot a form link the model missed
 * @param emailOnly       the page gives an email address and no apply link
 */
export function detectApplicationTool(
  applicationUrl: string | null | undefined,
  pageContent = "",
  emailOnly = false
): string | null {
  for (const haystack of [applicationUrl ?? "", pageContent]) {
    if (!haystack) continue;
    const hit = TOOLS.find((t) => t.pattern.test(haystack));
    if (hit) return hit.tool;
  }
  if (applicationUrl) return "Website form";
  if (emailOnly) return "Email";
  return null;
}
