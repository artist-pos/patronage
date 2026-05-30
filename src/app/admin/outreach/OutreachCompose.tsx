"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, Bold, Italic, Underline, Link, CornerDownRight } from "lucide-react";
import { sendOutreachEmail, cancelScheduledEmail, sendScheduledNow } from "./actions";

function buildHtml(_toName: string, _subject: string, body: string): string {
  const htmlBody = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 1.4em 0;font-size:15px;line-height:1.75;color:#1a1a1a">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:48px 24px 64px;">
    <tr><td>
      <p style="margin:0 0 4px;font-family:system-ui,sans-serif;font-size:20px;font-weight:600;color:#000;letter-spacing:-0.3px;">Patronage</p>
      <p style="margin:0 0 36px;font-family:system-ui,sans-serif;font-size:13px;color:#999;">hello@patronage.nz &middot; patronage.nz</p>
      <div style="border-top:1px solid #e8e8e8;margin-bottom:32px;"></div>
      <div style="font-family:system-ui,sans-serif;">
        ${htmlBody}
      </div>
      <div style="border-top:1px solid #e8e8e8;margin-top:40px;padding-top:20px;">
        <p style="margin:0;font-family:system-ui,sans-serif;font-size:11px;color:#aaa;">
          Patronage &middot; <a href="https://patronage.nz" style="color:#aaa;text-decoration:none;">patronage.nz</a> &middot; Auckland, New Zealand
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

function CcInput({ cc, onChange }: { cc: string[]; onChange: (cc: string[]) => void }) {
  const [input, setInput] = useState("");

  function addEmail() {
    const email = input.trim().replace(/,+$/, "");
    if (!email || cc.includes(email)) { setInput(""); return; }
    onChange([...cc, email]);
    setInput("");
  }

  return (
    <div className="flex flex-wrap gap-1.5 border border-border px-2.5 py-1.5 focus-within:border-foreground transition-colors min-h-[36px]">
      {cc.map((email, i) => (
        <span key={email} className="flex items-center gap-1 bg-stone-100 text-xs px-2 py-0.5 rounded-full shrink-0">
          {email}
          <button
            type="button"
            onClick={() => onChange(cc.filter((_, idx) => idx !== i))}
            className="text-stone-400 hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="email"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
            e.preventDefault();
            addEmail();
          }
          if (e.key === "Backspace" && !input && cc.length > 0) {
            onChange(cc.slice(0, -1));
          }
        }}
        onBlur={addEmail}
        placeholder={cc.length === 0 ? "Add CC… (Enter to add)" : ""}
        className="text-sm bg-transparent flex-1 min-w-[180px] focus:outline-none placeholder:text-stone-300"
      />
    </div>
  );
}

function PreviewModal({ toName, toEmail, cc, subject, body, onClose }: {
  toName: string;
  toEmail: string;
  cc: string[];
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
          {cc.length > 0 && <p><span className="text-stone-400">CC:</span> {cc.join(", ")}</p>}
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

function FormatToolbar({ textareaRef, onBodyChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onBodyChange: (val: string) => void;
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  function applyTag(open: string, close: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const replacement = `${open}${selected}${close}`;
    const newVal = ta.value.slice(0, start) + replacement + ta.value.slice(end);
    onBodyChange(newVal);
    setTimeout(() => {
      ta.focus();
      // Place cursor after closing tag if nothing was selected
      const pos = selected.length ? start + replacement.length : start + open.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  function applyLink() {
    const ta = textareaRef.current;
    const url = linkUrl.trim();
    if (!ta || !url) { setLinkMode(false); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || "link text";
    const replacement = `<a href="${url}">${selected}</a>`;
    const newVal = ta.value.slice(0, start) + replacement + ta.value.slice(end);
    onBodyChange(newVal);
    setLinkUrl("");
    setLinkMode(false);
    setTimeout(() => ta.focus(), 0);
  }

  useEffect(() => {
    if (linkMode) linkInputRef.current?.focus();
  }, [linkMode]);

  const btnCls = "p-1.5 text-stone-400 hover:text-foreground hover:bg-stone-100 transition-colors";

  return (
    <div className="border border-border border-b-0 bg-stone-50 flex items-center gap-0.5 px-2 py-1">
      <button
        type="button"
        title="Bold"
        onMouseDown={(e) => { e.preventDefault(); applyTag("<strong>", "</strong>"); }}
        className={btnCls}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Italic"
        onMouseDown={(e) => { e.preventDefault(); applyTag("<em>", "</em>"); }}
        className={btnCls}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Underline"
        onMouseDown={(e) => { e.preventDefault(); applyTag("<u>", "</u>"); }}
        className={btnCls}
      >
        <Underline className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button
        type="button"
        title="Link"
        onMouseDown={(e) => { e.preventDefault(); setLinkMode((v) => !v); setLinkUrl(""); }}
        className={`${btnCls} ${linkMode ? "text-foreground bg-stone-100" : ""}`}
      >
        <Link className="w-3.5 h-3.5" />
      </button>
      {linkMode && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkMode(false); }}
            placeholder="https://…"
            className="text-xs border border-border bg-white px-2 py-1 w-48 focus:outline-none focus:border-foreground"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
            className="text-xs font-medium px-2 py-1 bg-black text-white hover:opacity-80 transition-opacity"
          >
            Apply
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setLinkMode(false); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function OutreachCompose() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [toName, setToName] = useState(() => searchParams.get("name") ?? "");
  const [toEmail, setToEmail] = useState(() => searchParams.get("to") ?? "");
  const [subject, setSubject] = useState(() => searchParams.get("subject") ?? "");
  const [body, setBody] = useState(() => searchParams.get("body") ?? "");
  const [cc, setCc] = useState<string[]>([]);
  const [inReplyTo, setInReplyTo] = useState(() => searchParams.get("in_reply_to") ?? "");
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMounted = useRef(false);

  // Re-apply form when searchParams change (e.g. follow-up navigation)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const name = searchParams.get("name");
    const to = searchParams.get("to");
    const subj = searchParams.get("subject");
    const b = searchParams.get("body");
    if (name !== null) setToName(name);
    if (to !== null) setToEmail(to);
    if (subj !== null) setSubject(subj);
    if (b !== null) setBody(b);
    setInReplyTo(searchParams.get("in_reply_to") ?? "");
    setCc([]);
  }, [searchParams]);

  function handleSend() {
    setError(null);
    if (scheduling && !scheduledAt) {
      setError("Please select a send date and time.");
      return;
    }
    startTransition(async () => {
      const result = await sendOutreachEmail({
        toName, toEmail, subject, body, cc,
        inReplyTo: inReplyTo || undefined,
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
      setCc([]);
      setInReplyTo("");
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
          cc={cc}
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
          <label className={labelCls}>CC</label>
          <CcInput cc={cc} onChange={setCc} />
        </div>

        {inReplyTo && (
          <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-50 border border-border px-3 py-2">
            <span className="flex items-center gap-1.5">
              <CornerDownRight className="w-3 h-3 shrink-0" />
              Threaded reply — will appear in the recipient&apos;s existing conversation
            </span>
            <button type="button" onClick={() => setInReplyTo("")} className="hover:text-foreground transition-colors ml-3 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

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
          <FormatToolbar textareaRef={textareaRef} onBodyChange={setBody} />
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi Jane,\n\nI'm reaching out about…"}
            rows={10}
            className={`${inputCls} resize-y min-h-[200px]`}
          />
          <p className="text-[11px] text-muted-foreground">
            Double line breaks become paragraphs. Sent from hello@patronage.nz.
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

type SentEmail = {
  id: string;
  to_name: string;
  to_email: string;
  subject: string;
  body: string;
  cc_emails?: string[] | null;
  message_id?: string | null;
  sent_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function SentHistory({ emails }: { emails: SentEmail[] }) {
  const [selected, setSelected] = useState<SentEmail | null>(null);
  const router = useRouter();

  function handleFollowUp(email: SentEmail, e: React.MouseEvent) {
    e.stopPropagation();
    const subject = email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`;
    const params = new URLSearchParams({ to: email.to_email, name: email.to_name, subject });
    if (email.message_id) params.set("in_reply_to", email.message_id);
    router.push(`/admin/outreach?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      {selected && (
        <PreviewModal
          toName={selected.to_name}
          toEmail={selected.to_email}
          cc={selected.cc_emails ?? []}
          subject={selected.subject}
          body={selected.body}
          onClose={() => setSelected(null)}
        />
      )}
      <div className="divide-y divide-border">
        {emails.map((email) => (
          <button
            key={email.id}
            type="button"
            onClick={() => setSelected(email)}
            className="w-full py-3 flex items-start justify-between gap-4 text-left hover:bg-stone-50 transition-colors -mx-1 px-1"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium leading-snug truncate">{email.subject}</p>
              <p className="text-xs text-muted-foreground">
                {email.to_name} &lt;{email.to_email}&gt;
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 pt-0.5">
              <button
                type="button"
                onClick={(e) => handleFollowUp(email, e)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Compose a follow-up to this email"
              >
                <CornerDownRight className="w-3 h-3" /> Follow-up
              </button>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(email.sent_at)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

type ScheduledEmail = {
  id: string;
  to_name: string;
  to_email: string;
  subject: string;
  body: string;
  cc_emails?: string[] | null;
  scheduled_at: string | null;
};

function formatNzDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "—";
  return d.toLocaleString("en-NZ", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Pacific/Auckland",
  }) + " NZT";
}

export function ScheduledHistory({ emails }: { emails: ScheduledEmail[] }) {
  const [selected, setSelected] = useState<ScheduledEmail | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleCancel(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Permanently delete this scheduled email? The contents cannot be recovered.")) return;
    setActionError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await cancelScheduledEmail(id);
      setBusyId(null);
      if (result.error) { setActionError(result.error); return; }
      window.location.reload();
    });
  }

  function handleSendNow(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Send this email now? It will go out immediately.")) return;
    setActionError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await sendScheduledNow(id);
      setBusyId(null);
      if (result.error) { setActionError(result.error); return; }
      window.location.reload();
    });
  }

  return (
    <>
      {selected && (
        <PreviewModal
          toName={selected.to_name}
          toEmail={selected.to_email}
          cc={selected.cc_emails ?? []}
          subject={selected.subject}
          body={selected.body}
          onClose={() => setSelected(null)}
        />
      )}
      <div className="divide-y divide-border">
        {emails.map((email) => (
          <div
            key={email.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(email)}
            onKeyDown={(e) => { if (e.key === "Enter") setSelected(email); }}
            className="w-full py-3 flex items-start justify-between gap-4 text-left hover:bg-stone-50 transition-colors -mx-1 px-1 cursor-pointer"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium leading-snug truncate">{email.subject}</p>
              <p className="text-xs text-muted-foreground">
                {email.to_name} &lt;{email.to_email}&gt;
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 pt-0.5">
              <p className="text-xs text-amber-600 whitespace-nowrap">
                {formatNzDateTime(email.scheduled_at)}
              </p>
              <button
                type="button"
                onClick={(e) => handleSendNow(email.id, e)}
                disabled={isPending}
                className="text-xs font-medium text-foreground hover:opacity-70 transition-opacity disabled:opacity-40"
                title="Send this email immediately"
              >
                {busyId === email.id && isPending ? "Sending…" : "Send now"}
              </button>
              <button
                type="button"
                onClick={(e) => handleCancel(email.id, e)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                title="Permanently delete this scheduled email"
              >
                {busyId === email.id && isPending ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
        {actionError && (
          <p className="text-xs text-red-600 pt-2">{actionError}</p>
        )}
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
