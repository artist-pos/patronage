"use client";

import { useState } from "react";
import { CampaignCard } from "./CampaignCard";

interface Campaign {
  id: string;
  slug: string;
  title: string;
  campaign_type: string | null;
  cover_image_url: string | null;
  location_address: string | null;
  opportunity_type: string | null;
  opportunity_title: string | null;
  artist: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    region: string | null;
  };
}

interface Props {
  campaigns: Campaign[];
}

const FILTER_TABS = [
  { label: "All", value: null },
  { label: "Public art", value: "Public Art" },
  { label: "Art fairs", value: "Art Fair" },
  { label: "Grant-funded", value: "Grant" },
  { label: "Residencies", value: "Residency" },
];

function matchesFilter(campaign: Campaign, filter: string | null): boolean {
  if (!filter) return true;
  const type = campaign.opportunity_type ?? campaign.campaign_type ?? "";
  return type.toLowerCase().includes(filter.toLowerCase());
}

export function CampaignFilters({ campaigns }: Props) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const visible = campaigns.filter((c) => matchesFilter(c, activeFilter));

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveFilter(tab.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeFilter === tab.value
                ? "bg-stone-900 text-white border-stone-900"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="text-sm text-stone-500 py-8 text-center">
          No {activeFilter?.toLowerCase() ?? ""} campaigns right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {visible.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              artist={campaign.artist}
              opportunityTitle={campaign.opportunity_title}
              opportunityType={campaign.opportunity_type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
