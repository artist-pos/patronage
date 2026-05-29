export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { getOutreachHistory } from "./actions";
import { OutreachCompose, SentHistory, ScheduledHistory } from "./OutreachCompose";

export const metadata = { title: "Outreach — Admin — Patronage" };

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

      <Suspense fallback={null}>
        <OutreachCompose />
      </Suspense>

      {scheduled.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Scheduled ({scheduled.length})
          </p>
          <ScheduledHistory emails={scheduled} />
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
