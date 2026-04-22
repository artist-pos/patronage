import { getOutreachHistory } from "./actions";
import { OutreachCompose, CancelButton, SentHistory } from "./OutreachCompose";

export const metadata = { title: "Outreach — Admin — Patronage" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Pacific/Auckland",
  }) + " NZT";
}

export default async function OutreachPage() {
  const history = await getOutreachHistory();
  const scheduled = history.filter((e) => e.status === "scheduled");
  const sent = history.filter((e) => e.status === "sent");

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Outreach</h1>
        <p className="text-xs text-muted-foreground">
          Send emails from <span className="font-mono">hello@patronage.nz</span> to partners, councils, and potential collaborators.
        </p>
      </div>

      <OutreachCompose />

      {scheduled.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Scheduled ({scheduled.length})
          </p>
          <div className="divide-y divide-border">
            {scheduled.map((email) => (
              <div key={email.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-snug truncate">{email.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {email.to_name} &lt;{email.to_email}&gt;
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-xs text-amber-600 whitespace-nowrap">
                    {email.scheduled_at ? formatDateTime(email.scheduled_at) : "—"}
                  </p>
                  <CancelButton id={email.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Sent ({sent.length})
          </p>
          <SentHistory emails={sent} />
        </div>
      )}
    </div>
  );
}
