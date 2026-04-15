"use client";

import dynamic from "next/dynamic";
import type { DayPoint } from "@/lib/profileAnalytics";

const ProfileViewsChart = dynamic(
  () => import("@/components/analytics/ProfileViewsChart").then((m) => m.ProfileViewsChart),
  { ssr: false, loading: () => <div className="h-48 bg-muted animate-pulse" /> }
);

interface Props {
  data: DayPoint[];
  days: number;
}

export function ProfileViewsChartWrapper({ data, days }: Props) {
  return <ProfileViewsChart data={data} days={days} />;
}
