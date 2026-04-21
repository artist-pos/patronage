"use client";

import dynamic from "next/dynamic";
import type { DayPoint } from "@/lib/profileAnalytics";
import type { ReactNode } from "react";

const ProfileViewsChart = dynamic(
  () => import("@/components/analytics/ProfileViewsChart").then((m) => m.ProfileViewsChart),
  { ssr: false, loading: () => <div className="h-48 bg-muted animate-pulse" /> }
);

interface Props {
  data: DayPoint[];
  days: number;
  headerRight?: ReactNode;
}

export function ProfileViewsChartWrapper({ data, days, headerRight }: Props) {
  return <ProfileViewsChart data={data} days={days} headerRight={headerRight} />;
}
