"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Mail, ExternalLink, X } from "lucide-react";
import type { ClaimTokenStatus } from "@/types/database";
import type { EnrichedClaimToken } from "./actions";
import { sendClaimTokenEmail, expireClaimToken } from "./actions";

const STATUS_STYLES: Record<ClaimTokenStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  sent:    "bg-blue-50 text-blue-700",
  claimed: "bg-green-100 text-green-700",
  expired: "bg-stone-100 text-stone-500",
};

const STATUS_LABELS: Record<ClaimTokenStatus, string> = {
  pending: "Pending",
  sent:    "Sent",
  claimed: "Claimed",
  expired: "Expired",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
      title={copied ? "Copied!" : "Copy link"}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TokenRow({ token, onUpdated }: { token: EnrichedClaimToken; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const claimUrl = `${siteUrl}/claim/${token.token}`;

  function handleSend(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Send claim email to ${token.recipient_email ?? "?"}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await sendClaimTokenEmail(token.id);
      if (res.error) { setError(res.error); return; }
      onUpdated();
    });
  }

  function handleExpire(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Mark this token as expired?")) return;
    startTransition(async () => {
      const res = await expireClaimToken(token.id);
      if (res.error) { setError(res.error); }
      onUpdated();
    });
  }

  const tdCls = "py-2.5 pr-4 align-top text-xs";

  return (
    <tr className={`border-b border-border transition-colors hover:bg-stone-50 ${isPending ? "opacity-60" : ""}`}>
      <td className={tdCls}>
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{token.entity_name ?? "—"}</p>
          {token.entity_username && (
            <p className="text-muted-foreground font-mono">@{token.entity_username}</p>
          )}
        </div>
      </td>
      <td className={tdCls}>
        <span className="capitalize text-muted-foreground">{token.entity_type}</span>
      </td>
      <td className={tdCls}>
        <div className="space-y-0.5">
          <p>{token.recipient_name ?? "—"}</p>
          {token.recipient_email && (
            <p className="text-muted-foreground font-mono">{token.recipient_email}</p>
          )}
        </div>
      </td>
      <td className={tdCls}>
        <span className={`px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[token.status]}`}>
          {STATUS_LABELS[token.status]}
        </span>
      </td>
      <td className={tdCls}>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">{claimUrl}</span>
          <CopyButton text={claimUrl} />
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>
      <td className={`${tdCls} hidden md:table-cell`}>{formatDate(token.sent_at)}</td>
      <td className={`${tdCls} hidden md:table-cell`}>{formatDate(token.claimed_at)}</td>
      <td className={tdCls}>
        <div className="flex items-center gap-2">
          {(token.status === "pending" || token.status === "sent") && token.recipient_email && (
            <button
              onClick={handleSend}
              disabled={isPending}
              className="flex items-center gap-1 text-xs px-2 py-1 border border-border hover:bg-stone-50 transition-colors disabled:opacity-40"
              title="Send claim email"
            >
              <Mail className="w-3 h-3" />
              {token.status === "sent" ? "Resend" : "Send"}
            </button>
          )}
          {token.status !== "claimed" && token.status !== "expired" && (
            <button
              onClick={handleExpire}
              disabled={isPending}
              className="p-1 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
              title="Expire token"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  );
}

interface Props {
  tokens: EnrichedClaimToken[];
}

export function ClaimTokensTable({ tokens: initialTokens }: Props) {
  const [tokens, setTokens] = useState(initialTokens);
  const [filterStatus, setFilterStatus] = useState<ClaimTokenStatus | "">("");
  const [filterType, setFilterType] = useState<"partner" | "artist" | "">("");

  const filtered = tokens.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterType && t.entity_type !== filterType) return false;
    return true;
  });

  const selectCls = "text-xs border border-border bg-transparent px-2 py-1.5 focus:outline-none focus:border-foreground";
  const thCls = "text-left text-[10px] font-medium uppercase tracking-widest text-stone-400 py-2 pr-4 whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ClaimTokenStatus | "")} className={selectCls}>
          <option value="">All statuses</option>
          {(["pending", "sent", "claimed", "expired"] as ClaimTokenStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as "partner" | "artist" | "")} className={selectCls}>
          <option value="">All types</option>
          <option value="partner">Partner</option>
          <option value="artist">Artist</option>
        </select>
        <span className="text-xs text-muted-foreground ml-1">{filtered.length} token{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">No claim tokens yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>Entity</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Recipient</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Claim URL</th>
                <th className={`${thCls} hidden md:table-cell`}>Sent</th>
                <th className={`${thCls} hidden md:table-cell`}>Claimed</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TokenRow key={t.id} token={t} onUpdated={() => window.location.reload()} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
