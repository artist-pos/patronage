"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  sendClaimInvite,
  buildClaimOnlyBody,
  buildClaimPipelineBody,
  buildTemplateSubject,
  buildClaimUrl,
} from "@/app/admin/opportunities/claim-actions";
import type { Opportunity } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

type Template = "claim_only" | "claim_pipeline";

interface Props {
  opp: Opportunity;
  onClose: () => void;
  onSent: (msg: string) => void;
}

export function ClaimInvitePanel({ opp, onClose, onSent }: Props) {
  const claimToken = opp.claim_token;
  const claimUrl = claimToken ? buildClaimUrl(claimToken) : `${SITE_URL}/claim-listing/(token pending)`;

  const [template, setTemplate] = useState<Template>("claim_only");
  const [recipientEmail, setRecipientEmail] = useState(opp.claim_invite_email ?? opp.claim_email ?? "");
  const [recipientName, setRecipientName] = useState(opp.organiser ?? "");
  const [subject, setSubject] = useState(buildTemplateSubject("claim_only", opp.title));
  const [body, setBody] = useState("");
  const [bodyDirty, setBodyDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build initial body on mount
  useEffect(() => {
    const vars = { recipientName: recipientName || "there", opportunityTitle: opp.title, claimUrl };
    setBody(buildClaimOnlyBody(vars));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTemplate(t: Template) {
    if (bodyDirty) {
      if (!confirm("Switching template will replace your edits. Continue?")) return;
    }
    const vars = { recipientName: recipientName || "there", opportunityTitle: opp.title, claimUrl };
    const newBody = t === "claim_only" ? buildClaimOnlyBody(vars) : buildClaimPipelineBody(vars);
    setTemplate(t);
    setSubject(buildTemplateSubject(t, opp.title));
    setBody(newBody);
    setBodyDirty(false);
  }

  // Rebuild body preview when name changes (only if not dirty)
  function handleNameChange(name: string) {
    setRecipientName(name);
    if (!bodyDirty) {
      const vars = { recipientName: name || "there", opportunityTitle: opp.title, claimUrl };
      const newBody = template === "claim_only" ? buildClaimOnlyBody(vars) : buildClaimPipelineBody(vars);
      setBody(newBody);
    }
  }

  async function handleSend(scheduleFor9am: boolean) {
    if (!recipientEmail.trim()) { setError("Recipient email is required."); return; }
    setSending(true);
    setError(null);
    const result = await sendClaimInvite({
      opportunityId: opp.id,
      recipientEmail: recipientEmail.trim(),
      recipientName: recipientName.trim(),
      subject,
      body,
      template,
      scheduleFor9am,
    });
    setSending(false);
    if (result.error) { setError(result.error); return; }
    const msg = scheduleFor9am
      ? `Claim invite scheduled for 9am tomorrow to ${recipientEmail.trim()}`
      : `Claim invite sent to ${recipientEmail.trim()}`;
    onSent(msg);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-lg mx-4 my-8 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/20">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">Send claim invite</p>
            <p className="text-xs text-muted-foreground truncate">{opp.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Template selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Template</p>
            <div className="flex gap-2">
              {(["claim_only", "claim_pipeline"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTemplate(t)}
                  className={`text-xs px-3 py-1.5 border transition-colors ${
                    template === t ? "border-black bg-black text-white" : "border-border hover:border-black"
                  }`}
                >
                  {t === "claim_only" ? "Claim only" : "Claim + Pipeline pitch"}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">To *</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="partner@org.nz"
                className="w-full border border-border px-2 py-1.5 text-xs focus:outline-none focus:border-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Recipient name</label>
              <input
                type="text"
                value={recipientName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Organisation name"
                className="w-full border border-border px-2 py-1.5 text-xs focus:outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-border px-2 py-1.5 text-xs focus:outline-none focus:border-black"
            />
          </div>

          {/* Body */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Message</label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setBodyDirty(true); }}
              rows={14}
              className="w-full border border-border px-2 py-1.5 text-xs leading-relaxed focus:outline-none focus:border-black resize-none font-mono"
            />
          </div>

          {!claimToken && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
              No claim token yet — one will be generated when you send.
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Send buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSend(false)}
              className="flex-1 text-xs bg-black text-white px-4 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send now"}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSend(true)}
              className="flex-1 text-xs border border-black px-4 py-2.5 hover:bg-muted transition-colors disabled:opacity-50"
            >
              Schedule for 9am tomorrow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
