import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/collection/UploadForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add to collection — Patronage",
};

export default async function UploadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/dashboard/collection/upload");

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link
          href="/dashboard/collection"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to collection
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add to collection</h1>
        <p className="text-sm text-muted-foreground">
          Register a work you own. You can fill in as much detail as you have —
          completeness can wait. The record stays private until you publish it.
        </p>
      </div>

      <UploadForm />
    </div>
  );
}
