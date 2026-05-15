import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { NewWorkClient } from "./NewWorkClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add Work — Studio — Patronage" };

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function NewWorkPage({ searchParams }: PageProps) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/studio");
  }

  const { mode } = await searchParams;
  const defaultSale = mode === "sale";

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/studio?section=works" className="hover:text-foreground transition-colors">
          Works
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">New work</span>
      </div>

      <h1 className="text-xl font-semibold mb-8">Add a work</h1>

      <NewWorkClient profileId={user.id} defaultSale={defaultSale} />
    </div>
  );
}
