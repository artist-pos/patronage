import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { SectionLockGate } from "@/components/studio/SectionLockGate";
import { CampaignDeleteButton } from "@/components/campaigns/CampaignDeleteButton";
import { CreateCampaignFromSelectionButton } from "@/components/campaigns/CreateCampaignFromSelectionButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "QR Codes — Studio" };

export default async function StudioQrCodesPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const completionProfile = await fetchCompletionProfile(user.id);
  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  let campaigns: Array<{
    id: string; title: string; campaign_type: string; status: string;
    partner_name: string | null; campaign_start_date: string | null; campaign_end_date: string | null;
  }> = [];
  let unlinkedSelections: Array<{
    id: string;
    opportunity_id: string;
    opportunity: { id: string; title: string; type: string; organiser: string | null } | null;
  }> = [];

  if (profileComplete) {
    try {
      const [{ data: campaignsData }, { data: selectedApps }, { data: existingCampaigns }] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, title, campaign_type, status, partner_name, campaign_start_date, campaign_end_date")
          .eq("artist_profile_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("opportunity_applications")
          .select("id, opportunity_id, opportunity:opportunity_id(id, title, type, organiser)")
          .eq("artist_id", user.id)
          .in("status", ["selected", "approved_pending_assets"]),
        supabase
          .from("campaigns")
          .select("opportunity_id")
          .eq("artist_profile_id", user.id)
          .not("opportunity_id", "is", null),
      ]);
      campaigns = (campaignsData ?? []) as typeof campaigns;
      const linkedOppIds = new Set(
        ((existingCampaigns ?? []) as Array<{ opportunity_id: string | null }>)
          .map(c => c.opportunity_id)
          .filter(Boolean) as string[]
      );
      unlinkedSelections = ((selectedApps ?? []) as unknown as typeof unlinkedSelections)
        .filter(a => a.opportunity_id && !linkedOppIds.has(a.opportunity_id));
    } catch {
      // Table may not exist yet
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">QR Codes</h2>
          <p className="text-sm text-muted-foreground">
            QR codes for public art, exhibitions, and activations.
          </p>
        </div>
        {profileComplete && (
          <Link
            href="/studio/qr-codes/new"
            className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            + Create QR code
          </Link>
        )}
      </div>

      {profileComplete && unlinkedSelections.length > 0 && (
        <div className="space-y-3">
          {unlinkedSelections.map((sel) => (
            <div key={sel.id} className="flex items-center justify-between gap-4 border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-emerald-900">
                  You&apos;ve been selected for{" "}
                  <span className="font-semibold">{sel.opportunity?.title ?? "an opportunity"}</span>.
                </p>
                <p className="text-xs text-emerald-700">Create a QR code page to share your work with the public.</p>
              </div>
              <div className="shrink-0">
                <CreateCampaignFromSelectionButton
                  applicationId={sel.id}
                  opportunityId={sel.opportunity_id}
                  opportunityTitle={sel.opportunity?.title ?? ""}
                  opportunityType={sel.opportunity?.type ?? "other"}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!profileComplete ? (
        <SectionLockGate featureName="QR Codes" missingFields={missingFields} />
      ) : campaigns.length === 0 ? (
        <div className="py-16 space-y-3 text-center border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            QR codes appear here when you&apos;re selected for partner opportunities, or when you create one for your next show.
          </p>
          <Link
            href="/studio/qr-codes/new"
            className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            Create QR labels for your next show →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-4 py-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {c.partner_name ?? "Self-managed"}
                  {c.campaign_start_date && ` · ${c.campaign_start_date}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide ${
                  c.status === "live" ? "bg-green-100 text-green-700"
                    : c.status === "completed" ? "bg-stone-100 text-stone-500"
                    : "bg-stone-100 text-stone-600"
                }`}>
                  {c.status}
                </span>
                <Link
                  href={`/studio/qr-codes/${c.id}`}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {c.status === "live" ? "View →" : "Configure →"}
                </Link>
                <CampaignDeleteButton campaignId={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
