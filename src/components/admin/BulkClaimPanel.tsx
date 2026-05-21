"use client";

import { useState } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { sendSingleBulkInvite } from "@/app/admin/opportunities/claim-actions";
import type { Opportunity } from "@/types/database";

type Template = "claim_only" | "claim_pipeline";

interface Props {
  opps: Opportunity[];
  onClose: () => void;
  onDone: (msg: string) => void;
}

interface ItemStatus {
  state: "pending" | "sending" | "sent" | "skipped_sent" | "skipped_no_email" | "failed";
  error?: string;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export function BulkClaimPanel({ opps, onClose, onDone }: Props) {
  const [template, setTemplate] = useState<Template>("claim_only");
  const [scheduleFor9am, setScheduleFor9am] = useState(false);
  const [includeAlreadySent, setIncludeAlreadySent] = useState(false);
  // Email overrides for items that are missing one
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function updateStatus(id: string, s: ItemStatus) {
    setStatuses(prev => ({ ...prev, [id]: s }));
  }

  // Determine effective email for each opp
  function emailFor(o: Opportunity): string {
    return (emailOverrides[o.id] ?? o.claim_invite_email ?? o.claim_email ?? "").trim();
  }

  const alreadySentIds = new Set(opps.filter(o => o.claim_invite_sent_at).map(o => o.id));

  // Items that will actually be sent
  const sendableOpps = opps.filter(o => {
    if (alreadySentIds.has(o.id) && !includeAlreadySent) return false;
    return true;
  });

  async function handleSend() {
    if (!confirmed) { setConfirmed(true); return; }

    setRunning(true);
    let sent = 0, skippedSent = 0, skippedNoEmail = 0, failed = 0;
    const total = sendableOpps.length;
    setProgress({ done: 0, total });

    for (let i = 0; i < sendableOpps.length; i++) {
      const o = sendableOpps[i];

      if (alreadySentIds.has(o.id) && !includeAlreadySent) {
        updateStatus(o.id, { state: "skipped_sent" });
        skippedSent++;
        continue;
      }

      const email = emailFor(o);
      if (!email) {
        updateStatus(o.id, { state: "skipped_no_email" });
        skippedNoEmail++;
        setProgress({ done: i + 1, total });
        continue;
      }

      updateStatus(o.id, { state: "sending" });
      const result = await sendSingleBulkInvite(
        {
          opportunityId: o.id,
          recipientEmail: email,
          recipientName: o.organiser ?? "",
          organiserName: o.organiser ?? "",
          opportunityTitle: o.title,
          claimToken: o.claim_token,
          claimTokenExpiresAt: o.claim_token_expires_at,
          alreadySent: !!o.claim_invite_sent_at,
        },
        template,
        scheduleFor9am
      );

      if (result.error) {
        updateStatus(o.id, { state: "failed", error: result.error });
        failed++;
      } else {
        updateStatus(o.id, { state: "sent" });
        sent++;
      }

      setProgress({ done: i + 1, total });
      if (i < sendableOpps.length - 1) await sleep(500);
    }

    setRunning(false);
    const verb = scheduleFor9am ? "scheduled" : "sent";
    const msg = `${sent} claim invite${sent !== 1 ? "s" : ""} ${verb}. ${skippedSent} skipped (already sent). ${skippedNoEmail} skipped (no email). ${failed} failed.`;
    setSummary(msg);
    onDone(msg);
  }

  const confirmLabel = scheduleFor9am
    ? `Schedule ${sendableOpps.length} invite${sendableOpps.length !== 1 ? "s" : ""} for 9am tomorrow?`
    : `Send ${sendableOpps.length} invite${sendableOpps.length !== 1 ? "s" : ""} now?`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8"
      onClick={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-xl mx-4 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">Bulk claim invites</p>
            <p className="text-xs text-muted-foreground">{opps.length} opportunities selected</p>
          </div>
          {!running && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Template selector */}
          {!running && !summary && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Template</p>
                <div className="flex gap-2">
                  {(["claim_only", "claim_pipeline"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemplate(t)}
                      className={`text-xs px-3 py-1.5 border transition-colors ${
                        template === t ? "border-black bg-black text-white" : "border-border hover:border-black"
                      }`}
                    >
                      {t === "claim_only" ? "Claim only" : "Claim + Pipeline pitch"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeAlreadySent}
                    onChange={e => { setIncludeAlreadySent(e.target.checked); setConfirmed(false); }}
                  />
                  Include previously sent (re-send)
                </label>
              </div>
            </>
          )}

          {/* Opportunity list */}
          <div className="space-y-0 border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {opps.map(o => {
              const alreadySent = alreadySentIds.has(o.id);
              const email = emailFor(o);
              const status = statuses[o.id];
              const willSkip = alreadySent && !includeAlreadySent;

              return (
                <div key={o.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${willSkip ? "opacity-40" : ""}`}>
                  {/* Status icon */}
                  <div className="shrink-0 w-4">
                    {status?.state === "sent" && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                    {status?.state === "failed" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                    {status?.state === "sending" && (
                      <div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{o.title}</p>
                    <p className="text-muted-foreground truncate">{o.organiser}</p>
                  </div>

                  <div className="shrink-0">
                    {alreadySent && !status && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                        {includeAlreadySent ? "re-send" : "already sent"}
                      </span>
                    )}
                    {status?.state === "skipped_no_email" && (
                      <span className="text-[10px] text-destructive">no email</span>
                    )}
                    {status?.state === "failed" && (
                      <span className="text-[10px] text-destructive truncate max-w-[100px]">{status.error}</span>
                    )}
                  </div>

                  {/* Email override for missing emails */}
                  {!email && !running && !summary && (
                    <input
                      type="email"
                      placeholder="email@org.nz"
                      value={emailOverrides[o.id] ?? ""}
                      onChange={e => {
                        setEmailOverrides(prev => ({ ...prev, [o.id]: e.target.value }));
                        setConfirmed(false);
                      }}
                      className="w-32 border border-border px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-black"
                    />
                  )}
                  {email && !running && !summary && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{email}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          {running && progress && (
            <p className="text-xs text-muted-foreground text-center">
              Sending {progress.done} of {progress.total}…
            </p>
          )}

          {/* Summary */}
          {summary && (
            <p className="text-xs text-muted-foreground bg-muted/40 border border-border px-3 py-2">
              {summary}
            </p>
          )}

          {!running && !summary && (
            <div className="space-y-3">
              {/* Schedule toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={scheduleFor9am}
                  onChange={e => { setScheduleFor9am(e.target.checked); setConfirmed(false); }}
                />
                Schedule for 9am tomorrow (NZST)
              </label>

              {confirmed ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium">{confirmLabel}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSend}
                      className="flex-1 text-xs bg-black text-white px-4 py-2.5 hover:bg-black/80 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmed(false)}
                      className="flex-1 text-xs border border-border px-4 py-2.5 hover:border-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sendableOpps.length === 0}
                  className="w-full text-xs bg-black text-white px-4 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-40"
                >
                  {scheduleFor9am
                    ? `Schedule all for 9am tomorrow`
                    : `Send all now`}
                </button>
              )}
            </div>
          )}

          {summary && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs border border-black px-4 py-2.5 hover:bg-muted transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
