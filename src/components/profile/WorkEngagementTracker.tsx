"use client";

import { useEffect } from "react";

interface Props {
  workId: string;
  eventType?: "view" | "play" | "enquiry" | "share";
}

export function WorkEngagementTracker({ workId, eventType = "view" }: Props) {
  useEffect(() => {
    const key = `${eventType}:${workId}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;

    fetch("/api/log-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_id: workId, event_type: eventType }),
    }).catch(() => {});

    if (typeof sessionStorage !== "undefined") {
      try { sessionStorage.setItem(key, "1"); } catch { /* quota */ }
    }
  }, [workId, eventType]);

  return null;
}
