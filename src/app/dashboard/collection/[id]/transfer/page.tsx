import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCollectionEntry } from "@/lib/collection";
import { TransferForm } from "@/components/collection/TransferForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transfer this work — Patronage",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TransferPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?redirect=/dashboard/collection/${id}/transfer`);

  const entry = await getCollectionEntry(id, user.id);
  if (!entry) notFound();

  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link
          href={`/dashboard/collection/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to {entry.artwork.title ?? "this work"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Transfer this work</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Sell {entry.artwork.title ?? "this work"} by {artistName} on
          Patronage. Buyers pay sticker price + 15% (10% Patronage commission +
          5% artist royalty). You receive the sticker amount.
        </p>
      </div>

      <TransferForm
        membershipId={entry.membership.id}
        workTitle={entry.artwork.title ?? "Untitled"}
        artistName={artistName}
      />
    </div>
  );
}
