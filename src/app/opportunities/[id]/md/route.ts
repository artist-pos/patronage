import { NextResponse } from "next/server";
import { getOpportunityById } from "@/lib/opportunities";
import { summariseOpportunity } from "@/lib/opportunity-summary";
import { nzDatePlus } from "@/lib/deadline-reminders";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** A listing as clean Markdown: the same facts as the page, without the chrome. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await getOpportunityById(id);
  if (!opp) return new NextResponse("Not found", { status: 404 });

  const url = `${SITE_URL}/opportunities/${opp.slug ?? opp.id}`;
  const body = [
    `# ${opp.title}`,
    "",
    ...summariseOpportunity(opp, nzDatePlus(0)),
    "",
    opp.sub_categories?.length ? `**Disciplines:** ${opp.sub_categories.join(", ")}` : null,
    opp.career_stage?.length ? `**Career stage:** ${opp.career_stage.join(", ")}` : null,
    "",
    opp.full_description ?? opp.caption ?? opp.description ?? "",
    "",
    "---",
    `Source: ${url} (Patronage, patronage.nz). Apply or check the latest details at the organiser's own page: ${opp.url ?? url}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
