import { getOutreachHistory } from "./actions";
import { OutreachCompose } from "./OutreachCompose";

export const metadata = { title: "Outreach — Admin — Patronage" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function OutreachPage() {
  const history = await getOutreachHistory();

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Outreach</h1>
        <p className="text-xs text-muted-foreground">
          Send emails from <span className="font-mono">hello@patronage.nz</span> to partners, councils, and potential collaborators.
        </p>
      </div>

      <OutreachCompose />

      {history.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Sent ({history.length})
          </p>
          <div className="divide-y divide-border">
            {history.map((email) => (
              <div key={email.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-snug truncate">{email.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {email.to_name} &lt;{email.to_email}&gt;
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(email.sent_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
