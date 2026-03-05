"use client";

import dynamic from "next/dynamic";

export const AdminEditOpportunityModal = dynamic(
  () => import("./AdminEditOpportunityModal").then((m) => m.AdminEditOpportunityModal),
  { ssr: false }
);
