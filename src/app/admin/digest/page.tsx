export const dynamic = "force-dynamic";
import { getDigestData, digestSubject, DIGEST_SIZE } from "@/lib/digest";
import { getDigestRecipientCount, getLastDigestSend } from "@/lib/digest-send";
import { DigestControls } from "./DigestControls";

export const metadata = { title: "Digest — Admin" };

function fmt(d: string | null) {
  if (!d) return "Open deadline";
  return new Date(d + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtSent(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminDigestPage() {
  const [subscriberCount, digest, lastSend] = await Promise.all([
    getDigestRecipientCount(),
    getDigestData(),
    getLastDigestSend(),
  ]);
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const picks = digest.opportunities;
  const isEmpty = picks.length === 0;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Weekly Digest</h1>
        <p className="text-xs text-muted-foreground">
          {subscriberCount} recipient{subscriberCount !== 1 ? "s" : ""}
          {lastSend
            ? ` · last sent ${fmtSent(lastSend.sent_at)}`
            : " · never sent"}
        </p>
        <p className="text-xs text-muted-foreground">
          Preview shows an unsuppressed issue. A real send skips what each
          person has already been shown, so individual emails will differ.
        </p>
      </div>

      <DigestControls
        subscriberCount={subscriberCount}
        hasResend={hasResend}
        isEmpty={isEmpty}
      />

      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-8 border-t border-border">
          Nothing to send — no open opportunities to curate right now.
        </p>
      ) : (
        <div className="space-y-4 border-t border-border pt-10">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            This week&apos;s picks ({picks.length} of {DIGEST_SIZE})
          </h2>
          <p className="text-xs text-muted-foreground">
            Subject line: <span className="font-mono">{digestSubject(picks.length)}</span>
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-medium text-muted-foreground">#</th>
                <th className="py-2 pr-4 font-medium text-muted-foreground">Title</th>
                <th className="py-2 pr-4 font-medium text-muted-foreground">Type</th>
                <th className="py-2 pr-4 font-medium text-muted-foreground">Location</th>
                <th className="py-2 pr-4 font-medium text-muted-foreground">Value</th>
                <th className="py-2 font-medium text-muted-foreground">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((o, i) => (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-4">
                    <p className="font-medium">{o.title}</p>
                    <p className="text-muted-foreground">{o.organiser}</p>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{o.type}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {o.city ? `${o.city}, ${o.country}` : o.country}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {o.funding_range ?? (o.funding_amount != null ? `$${o.funding_amount.toLocaleString("en-NZ")}` : "—")}
                  </td>
                  <td className="py-2 text-muted-foreground">{fmt(o.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
