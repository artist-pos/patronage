"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { sendOutreachEmail, cancelScheduledEmail } from "./actions";

function buildHtml(toName: string, subject: string, body: string): string {
  const htmlBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 1em 0;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f0">
  <div style="max-width:620px;margin:40px auto;background:#ffffff;border:1px solid #e5e5e5">
    <!-- Header -->
    <div style="padding:24px 32px;border-bottom:1px solid #e5e5e5">
      <p style="margin:0;font-family:Georgia,serif;font-size:18px;font-weight:600;letter-spacing:-0.3px;color:#1a1a1a">Patronage</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;font-family:Georgia,serif;font-size:15px;color:#1a1a1a">
      ${htmlBody}
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e5e5e5;background:#fafaf9">
      <p style="margin:0;font-family:sans-serif;font-size:11px;color:#999">
        Patronage · <a href="https://patronage.nz" style="color:#999">patronage.nz</a>
        &nbsp;·&nbsp; hello@patronage.nz
      </p>
    </div>
  </div>
</body>
</html>`;
}

function PreviewModal({ toName, toEmail, subject, body, onClose }: {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(buildHtml(toName, subject, body));
    doc.close();
  }, [toName, subject, body]);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl space-y-3 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-stone-100 border border-border text-xs text-muted-foreground px-4 py-3 space-y-1 font-mono">
          <p><span className="text-stone-400">From:</span> Patronage &lt;hello@patronage.nz&gt;</p>
          <p><span className="text-stone-400">To:</span> {toName} &lt;{toEmail}&gt;</p>
          <p><span className="text-stone-400">Subject:</span> {subject}</p>
        </div>

        <div className="border border-border overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Email preview"
            className="w-full"
            style={{ height: "520px", border: "none" }}
            sandbox="allow-same-origin"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Close preview
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutreachCompose() {
  const [isPending, startTransition] = useTransition();
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function handleSend() {
    setError(null);
    if (scheduling && !scheduledAt) {
      setError("Please select a send date and time.");
      return;
    }
    startTransition(async () => {
      const result = await sendOutreachEmail({
        toName, toEmail, subject, body,
        scheduledAt: scheduling ? scheduledAt : undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setToName("");
      setToEmail("");
      setSubject("");
      setBody("");
      setScheduledAt("");
      setScheduling(false);
      setToast(scheduling ? "Email scheduled." : "Email sent.");
      setTimeout(() => setToast(null), 3000);
    });
  }

  const canSend = !!(toName && toEmail && subject && body);

  const labelCls = "text-xs font-medium uppercase tracking-widest text-stone-400";
  const inputCls = "w-full text-sm border border-border bg-transparent px-3 py-2 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300";

  return (
    <>
      {previewing && canSend && (
        <PreviewModal
          toName={toName}
          toEmail={toEmail}
          subject={subject}
          body={body}
          onClose={() => setPreviewing(false)}
        />
      )}

      <div className="space-y-4 border border-border p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Compose</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Name</label>
            <input
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Jane Smith"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="jane@organisation.nz"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Partnering with Patronage"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi Jane,\n\nI'm reaching out about…"}
            rows={10}
            className={`${inputCls} resize-y min-h-[200px]`}
          />
          <p className="text-[11px] text-muted-foreground">
            Plain text — double line breaks become paragraphs. Sent from hello@patronage.nz.
          </p>
        </div>

        {scheduling && (
          <div className="space-y-1.5">
            <label className={labelCls}>Send at (NZ time)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {toast ? (
            <p className="text-xs text-green-600">{toast}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              disabled={!canSend}
              className="text-sm font-medium px-5 py-2.5 border border-border hover:bg-stone-50 transition-colors disabled:opacity-40"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => { setScheduling((s) => !s); setScheduledAt(""); }}
              className={`text-sm font-medium px-5 py-2.5 border transition-colors ${
                scheduling
                  ? "border-black bg-stone-100 text-black"
                  : "border-border hover:bg-stone-50"
              }`}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !canSend}
              className="text-sm font-medium px-5 py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {isPending
                ? scheduling ? "Scheduling…" : "Sending…"
                : scheduling ? "Schedule Email" : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function CancelButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      await cancelScheduledEmail(id);
      window.location.reload();
    });
  }

  return (
    <button
      onClick={handleCancel}
      disabled={isPending}
      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
