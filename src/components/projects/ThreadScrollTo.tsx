"use client";

import { useEffect } from "react";

export function ThreadScrollTo({ postId }: { postId: string }) {
  useEffect(() => {
    const el = document.getElementById(`post-${postId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [postId]);

  return null;
}
