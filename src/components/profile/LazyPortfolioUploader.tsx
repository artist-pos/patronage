"use client";

import dynamic from "next/dynamic";

const PortfolioUploader = dynamic(
  () => import("@/components/profile/PortfolioUploader").then((m) => ({ default: m.PortfolioUploader })),
  { ssr: false, loading: () => <div className="h-32 border border-dashed border-border" /> }
);

export { PortfolioUploader as LazyPortfolioUploader };
