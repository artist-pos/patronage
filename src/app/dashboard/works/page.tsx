import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorksTable } from "@/components/dashboard/WorksTable";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { AddWorkButton } from "@/components/dashboard/AddWorkButton";
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
  const section = (["portfolio", "available", "sold"].includes(params.section ?? "") ? params.section : "portfolio") as "portfolio" | "available" | "sold";

  const [portfolioResult, availableResult, soldResult] = await Promise.all([
    supabase
      .from("portfolio_images")
      .select("id, url, caption, description, hide_from_archive, position, created_at, content_type")
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

  // is_featured requires migration 041 — fetch separately so the page works without it
  const { data: featuredRows } = await supabase
    .from("portfolio_images")
    .select("id, is_featured")
    .eq("profile_id", user.id)
    .eq("is_available", false)
    .eq("is_featured", true);

  const featuredIds = new Set((featuredRows ?? []).map((r: { id: string }) => r.id));

  const portfolioWorks = (portfolioResult.data ?? []).map(w => ({
    ...w,
    is_featured: featuredIds.has(w.id),
  }));
  const availableWorks = availableResult.data ?? [];
  const soldWorks = soldResult.data ?? [];

  const featuredCount = featuredIds.size;

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
              section === key
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Portfolio section */}
      {section === "portfolio" && (
        <div className="space-y-6">
          {featuredCount > 0 || portfolioWorks.length > 0 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground border border-border px-4 py-2.5">
              <span>
                <span className="font-semibold text-foreground">{featuredCount}</span> of 8 works featured
                {featuredCount > 0 && " — shown on your profile overview"}
              </span>
              {featuredCount === 0 && (
                <span>Open any work and mark it as Featured to curate your overview.</span>
              )}
            </div>
          ) : null}

          <WorksTable
            section="portfolio"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
          />

          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-4">Add portfolio works</p>
            <PortfolioUploader profileId={user.id} />
          </div>
        </div>
      )}

      {/* Available section */}
      {section === "available" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Works listed for sale. Patrons can make offers directly from your profile.
            </p>
            <AddWorkButton profileId={user.id} />
          </div>
          <WorksTable
            section="available"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
          />
        </div>
      )}

      {/* Sold section */}
      {section === "sold" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Works transferred to collectors. These are permanent provenance records.
          </p>
          <WorksTable
            section="sold"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
          />
        </div>
      )}
    </div>
  );
}
