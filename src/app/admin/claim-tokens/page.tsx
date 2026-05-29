import { getClaimTokens } from "./actions";
import { ClaimTokensClient } from "./ClaimTokensClient";

export default async function ClaimTokensPage() {
  const tokens = await getClaimTokens();

  const counts = tokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-[1600px] space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Claim Tokens</h1>
        <p className="text-xs text-muted-foreground">
          Pre-build partner and artist profiles and send ownership links to recipients.
        </p>
      </div>

      {tokens.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(["pending", "sent", "claimed", "expired"] as const).map((s) => (
            <div key={s} className="border border-border p-3 space-y-1">
              <p className="text-lg font-semibold">{counts[s] ?? 0}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 capitalize">{s}</p>
            </div>
          ))}
        </div>
      )}

      <ClaimTokensClient initialTokens={tokens} />
    </div>
  );
}
