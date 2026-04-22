"use client";

import { useState, useTransition } from "react";
import { sendOutreachEmail } from "./actions";

export function OutreachCompose() {
  const [isPending, startTransition] = useTransition();
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendOutreachEmail({ toName, toEmail, subject, body });
      if (result.error) {
        setError(result.error);
        return;
      }
      setToName("");
      setToEmail("");
      setSubject("");
      setBody("");
      setToast("Email sent.");
      setTimeout(() => setToast(null), 3000);
    });
  }

  const labelCls = "text-xs font-medium uppercase tracking-widest text-stone-400";
  const inputCls = "w-full text-sm border border-border bg-transparent px-3 py-2 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300";

  return (
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        {toast ? (
          <p className="text-xs text-green-600">{toast}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !toName || !toEmail || !subject || !body}
          className="text-sm font-medium px-5 py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {isPending ? "Sending…" : "Send Email"}
        </button>
      </div>
    </div>
  );
}
