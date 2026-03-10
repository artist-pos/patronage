import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorksTable } from "@/components/dashboard/WorksTable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Works — Patronage",
};

interface PageProps {
  searchParams: Promise<{ section?: string }>;
}

export default async function DashboardWorksPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const section = params.section === "available" ? "available" : "portfolio";

  const [portfolioResult, availableResult, soldResult] = await Promise.all([
    supabase
      .from("portfolio_images")
      .select("id, url, caption, description, is_featured, hide_from_archive, position, created_at, content_type")
      .eq("profile_id", user.id)
      .eq("is_available", false)
      .order("position", { ascending: true }),
    supabase
      .from("artworks")
      .select("id, url, caption, description, price, price_currency, is_available, hide_available, position, created_at")
      .eq("profile_id", user.id)
      .eq("is_available", true)
      .order("position", { ascending: true }),
    supabase
      .from("artworks")
      .select("id, url, caption, price, price_currency, created_at, current_owner_id")
      .eq("creator_id", user.id)
      .neq("current_owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const portfolioWorks = portfolioResult.data ?? [];
  const availableWorks = availableResult.data ?? [];
  const soldWorks = soldResult.data ?? [];

  const featuredCount = portfolioWorks.filter(w => w.is_featured).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Works</h1>
          <p className="text-sm text-muted-foreground">
            Manage your portfolio, available works, and sales history.
          </p>
        </div>
        <Link
          href={`/${profile.username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View public profile →
        </Link>
      </div>

      {/* Section tabs */}
      <div className="flex gap-0 border-b border-black">
        {[
          { key: "portfolio", label: `Portfolio (${portfolioWorks.length})` },
          { key: "available", label: `Available (${availableWorks.length})` },
          { key: "sold", label: `Sold (${soldWorks.length})` },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/dashboard/works?section=${key}`}
            className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
              section === key || (section === "portfolio" && key === "portfolio")
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Featured notice */}
      {section === "portfolio" && (
        <div className="flex items-center justify-between text-xs text-muted-foreground border border-border px-4 py-2.5">
          <span>
            <span className="font-semibold text-foreground">{featuredCount}</span> of 8 works featured
            {featuredCount > 0 && " — shown on your profile overview"}
          </span>
          {featuredCount === 0 && (
            <span className="text-muted-foreground">
              Click any work to open it, then mark it as Featured to curate your overview.
            </span>
          )}
        </div>
      )}

      <WorksTable
        section={section as "portfolio" | "available" | "sold"}
        portfolioWorks={portfolioWorks}
        availableWorks={availableWorks}
        soldWorks={soldWorks}
        featuredCount={featuredCount}
      />
    </div>
  );
}
