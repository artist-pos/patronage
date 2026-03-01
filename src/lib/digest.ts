import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/types/database";

export interface DigestData {
  newOpps: Opportunity[];
  closingSoon: Opportunity[];
  generatedAt: string;
}

export async function getDigestData(): Promise<DigestData> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekAgo = new Date(today.getTime() - 7 * 864e5).toISOString().split("T")[0];
  const weekAhead = new Date(today.getTime() + 7 * 864e5).toISOString().split("T")[0];

  const [{ data: newData }, { data: closingData }] = await Promise.all([
    // New: added in the last 7 days, still active
    supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .gte("created_at", weekAgo)
      .or(`deadline.is.null,deadline.gte.${todayStr}`)
      .order("created_at", { ascending: false }),

    // Closing soon: deadline within the next 7 days
    supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .gte("deadline", todayStr)
      .lte("deadline", weekAhead)
      .order("deadline", { ascending: true }),
  ]);

  return {
    newOpps: (newData ?? []) as Opportunity[],
    closingSoon: (closingData ?? []) as Opportunity[],
    generatedAt: today.toISOString(),
  };
}

export function buildDigestHtml(data: DigestData, siteUrl: string): string {
  const fmt = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : "Open deadline";

  const oppBlock = (opps: Opportunity[]) =>
    opps.map((o) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;">
          <strong>${o.title}</strong><br>
          <span style="color:#888;font-size:13px;">${o.organiser} · ${o.type} · ${o.country}</span><br>
          <span style="color:#888;font-size:13px;">Deadline: ${fmt(o.deadline)}</span><br>
          ${o.url ? `<a href="${o.url}" style="color:#000;font-size:13px;">View opportunity →</a>` : ""}
        </td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:600;margin:0 0 4px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 32px;">Weekly opportunities digest</p>

      ${data.newOpps.length > 0 ? `
      <h2 style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:0 0 8px;">New this week</h2>
      <table width="100%" cellpadding="0" cellspacing="0">${oppBlock(data.newOpps)}</table>
      <br>` : ""}

      ${data.closingSoon.length > 0 ? `
      <h2 style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:24px 0 8px;">Closing this week</h2>
      <table width="100%" cellpadding="0" cellspacing="0">${oppBlock(data.closingSoon)}</table>
      <br>` : ""}

      <p style="color:#888;font-size:12px;margin:32px 0 0;">
        You're receiving this because you subscribed at <a href="${siteUrl}" style="color:#888;">${siteUrl}</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
