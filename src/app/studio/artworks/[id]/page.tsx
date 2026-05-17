import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Work — Studio — Patronage" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArtworkProvenancePage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/studio/works/${id}`);
}
