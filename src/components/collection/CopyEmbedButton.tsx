"use client";

import { useState } from "react";

interface Props {
  username: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export function CopyEmbedButton({ username }: Props) {
  const [copied, setCopied] = useState(false);

  const src = `${SITE_URL}/embed/${username}/collection`;
  const code = `<iframe src="${src}" width="100%" height="600" frameborder="0" style="border:none;overflow:hidden" scrolling="no" title="${username} Collection — Patronage"></iframe>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
    >
      {copied ? "Copied!" : "Copy embed code"}
    </button>
  );
}
