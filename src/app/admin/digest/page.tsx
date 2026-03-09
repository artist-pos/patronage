import { createClient } from "@/lib/supabase/server";
import { getDigestData } from "@/lib/digest";
import { DigestControls } from "./DigestControls";

export const metadata = { title: "Digest — Admin — Patronage" };

function fmt(d: string | null) {
  if (!d) return "Open deadline";
  return new Date(d + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminDigestPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  const digest = await getDigestData();
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const subscriberCount = count ?? 0;
  const isEmpty = digest.newOpps.length === 0 && digest.closingSoon.length === 0;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Weekly Digest</h1>
        <p className="text-xs text-muted-foreground">
          {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""} ·
          Preview below shows what would be sent right now.
        </p>
      </div>

      <DigestControls
        subscriberCount={subscriberCount}
        hasResend={hasResend}
        isEmpty={isEmpty}
      />

      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-8 border-t border-border">
          Nothing to send — no new or closing-soon opportunities this week.
        </p>
      ) : (
        <div className="space-y-10 border-t border-border pt-10">
          {digest.newOpps.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                New this week ({digest.newOpps.length})
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Title</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Type</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Country</th>
                    <th className="py-2 font-medium text-muted-foreground">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {digest.newOpps.map((o) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{o.title}</p>
                        <p className="text-muted-foreground">{o.organiser}</p>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{o.type}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{o.country}</td>
                      <td className="py-2 text-muted-foreground">{fmt(o.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {digest.closingSoon.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                Closing this week ({digest.closingSoon.length})
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Title</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Type</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Country</th>
                    <th className="py-2 font-medium text-muted-foreground">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {digest.closingSoon.map((o) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 pr-4">
                        <p className="font-medium">{o.title}</p>
                        <p className="text-muted-foreground">{o.organiser}</p>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{o.type}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{o.country}</td>
                      <td className="py-2 text-muted-foreground">{fmt(o.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
