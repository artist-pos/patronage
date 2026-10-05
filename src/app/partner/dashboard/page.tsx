import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Dashboard",
};

export default async function PartnerDashboardPage() {
  redirect("/studio");
}
