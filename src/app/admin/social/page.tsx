import { createClient } from "@/lib/supabase/server";
import { SocialContentPanel } from "@/components/admin/SocialContentPanel";

export const metadata = { title: "Social Content — Admin — Patronage" };

export interface SocialOpp {
  id: string;
  title: string;
  organiser: string;
  type: string;
  country: string;
  deadline: string | null;
  created_at: string;
  caption: string | null;
  description: string | null;
  funding_range: string | null;
  funding_amount: number | null;
  entry_fee: number | null;
  entry_fee_local: number | null;
  entry_fee_currency: string | null;
  sub_categories: string[] | null;
  tags: string[] | null;
  url: string | null;
  slug: string | null;
}

const FIELDS = [
  "id", "title", "organiser", "type", "country", "deadline", "created_at",
  "caption", "description", "funding_range", "funding_amount",
  "entry_fee", "entry_fee_local", "entry_fee_currency",
  "sub_categories", "tags", "url", "slug",
].join(", ");

export default async function SocialPage() {
  const supabase = await createClient();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const sevenDaysLaterStr = sevenDaysLater.toISOString().split("T")[0];

  const fourteenDaysLater = new Date(today);
  fourteenDaysLater.setDate(today.getDate() + 14);
  const fourteenDaysLaterStr = fourteenDaysLater.toISOString().split("T")[0];

  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);
  const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0];

  const [newRes, soonRes, finalRes] = await Promise.all([
    // New This Week — created in last 7 days, not yet expired
    supabase
      .from("opportunities")
      .select(FIELDS)
      .eq("is_active", true)
      .eq("status", "published")
      .gte("created_at", sevenDaysAgo.toISOString())
      .or(`deadline.gte.${todayStr},deadline.is.null`)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),

    // Closing Soon — deadline in 7–14 days
    supabase
      .from("opportunities")
      .select(FIELDS)
      .eq("is_active", true)
      .eq("status", "published")
      .gte("deadline", sevenDaysLaterStr)
      .lte("deadline", fourteenDaysLaterStr)
      .order("deadline", { ascending: true })
      .limit(3),

    // Final Call — deadline today through 3 days
    supabase
      .from("opportunities")
      .select(FIELDS)
      .eq("is_active", true)
      .eq("status", "published")
      .gte("deadline", todayStr)
      .lte("deadline", threeDaysLaterStr)
      .order("deadline", { ascending: true })
      .limit(6),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Social Content</h1>
        <p className="text-xs text-muted-foreground">
          Pre-grouped opportunities for social media posts. Copy ready-to-use captions.
        </p>
      </div>
      <SocialContentPanel
        newThisWeek={(newRes.data ?? []) as unknown as SocialOpp[]}
        closingSoon={(soonRes.data ?? []) as unknown as SocialOpp[]}
        finalCall={(finalRes.data ?? []) as unknown as SocialOpp[]}
        today={todayStr}
      />
    </div>
  );
}
