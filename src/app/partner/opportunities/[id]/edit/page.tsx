import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { Metadata } from "next";
import { PartnerEditForm } from "./PartnerEditForm";

export const metadata: Metadata = {
  title: "Edit Listing — Patronage",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PartnerEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: opp } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (!opp) notFound();

  const admin = await isAdmin();
  if (opp.profile_id !== user.id && !admin) {
    redirect("/partner/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Listing</h1>
        <p className="text-sm text-muted-foreground">
          {opp.status === "draft" || opp.status === "draft_unclaimed"
            ? "This listing is a draft — publish it when you're ready."
            : opp.status === "published"
            ? "This listing is live on Patronage."
            : `Status: ${opp.status}`}
        </p>
      </div>

      <PartnerEditForm opp={opp} />
    </div>
  );
}
