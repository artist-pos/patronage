"use client";

import { useActionState } from "react";
import { upsertProfileAction, type ProfileFormState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediumInput } from "./MediumInput";
import { DisciplineInput } from "./DisciplineInput";
import type { Profile, DisciplineEnum } from "@/types/database";
import { IDENTITY_TAGS } from "@/lib/constants/demographics";

const COUNTRIES = ["NZ", "AUS", "Global"] as const;
const STAGES = ["Emerging", "Mid-Career", "Established", "Open"] as const;

interface Props {
  profile: Profile | null;
  role: Profile["role"];
}

export function ProfileForm({ profile, role }: Props) {
  const isArtist = role === "artist" || role === "owner";
  const [state, action, isPending] = useActionState<ProfileFormState, FormData>(
    upsertProfileAction,
    {}
  );

  const currentYear = new Date().getFullYear();
  const minYear = 1920;
  const maxYear = currentYear - 10;

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="username">
          Username <span className="text-destructive">*</span>
        </Label>
        <Input
          id="username"
          name="username"
          defaultValue={profile?.username ?? ""}
          placeholder="yourname"
          pattern="[a-z0-9_-]{3,30}"
          required
          className="border-black"
        />
        {state.fieldErrors?.username && (
          <p className="text-xs text-destructive">{state.fieldErrors.username}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your public URL will be patronage.nz/<strong>username</strong>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile?.full_name ?? ""}
          placeholder="Your name"
          className="border-black"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Artist statement</Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={profile?.bio ?? ""}
          rows={4}
          placeholder={isArtist ? "A short description of your practice…" : "Describe your mission or interest in supporting the arts…"}
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            name="city"
            defaultValue={(profile as Profile & { city?: string | null })?.city ?? ""}
            placeholder="e.g. Auckland, Melbourne, Christchurch"
            required
            className="border-black"
          />
          {state.fieldErrors?.city && (
            <p className="text-xs text-destructive">{state.fieldErrors.city}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            name="country"
            defaultValue={profile?.country ?? ""}
            className="w-full border border-black bg-background px-3 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">— Select —</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {isArtist && (
        <div className="space-y-2">
          <Label htmlFor="career_stage">Career stage</Label>
          <select
            id="career_stage"
            name="career_stage"
            defaultValue={profile?.career_stage ?? ""}
            className="w-full border border-black bg-background px-3 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">— Select —</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        {isArtist ? (
          <>
            <Label>Disciplines</Label>
            <p className="text-xs text-muted-foreground">
              Select all that apply to your practice.
            </p>
            <DisciplineInput
              defaultValue={(profile?.disciplines ?? []) as DisciplineEnum[]}
            />
          </>
        ) : (
          <>
            <Label>Taste</Label>
            <MediumInput defaultValue={profile?.medium ?? []} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="website_url">Website</Label>
          <Input
            id="website_url"
            name="website_url"
            type="url"
            defaultValue={profile?.website_url ?? ""}
            placeholder="https://yoursite.com"
            className="border-black"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagram_handle">Instagram</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
            <Input
              id="instagram_handle"
              name="instagram_handle"
              defaultValue={profile?.instagram_handle ?? ""}
              placeholder="handle"
              className="pl-7 border-black"
            />
          </div>
        </div>
      </div>

      {/* ── Demographics (opt-in, private, for anonymised reporting) ── */}
      <div className="space-y-5 border-t border-border pt-6">
        <div className="space-y-1">
          <p className="text-sm font-medium">Demographics</p>
          <p className="text-xs text-muted-foreground">
            This information is never shown on your public profile. It is used only for anonymised, aggregate reporting to help arts organisations understand who they are reaching.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="year_of_birth">
            Year of birth <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="year_of_birth"
            name="year_of_birth"
            type="number"
            min={minYear}
            max={maxYear}
            defaultValue={(profile as Profile & { year_of_birth?: number | null })?.year_of_birth ?? ""}
            placeholder={`e.g. ${currentYear - 30}`}
            className="border-black"
          />
          {state.fieldErrors?.year_of_birth && (
            <p className="text-xs text-destructive">{state.fieldErrors.year_of_birth}</p>
          )}
          <p className="text-xs text-muted-foreground">Used only for anonymised, aggregate age-bracket reporting.</p>
        </div>

        <div className="space-y-2">
          <Label>
            How do you identify? <span className="text-xs text-muted-foreground font-normal">(optional — select all that apply)</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {IDENTITY_TAGS.map((tag) => {
              const checked = ((profile as Profile & { identity_tags?: string[] })?.identity_tags ?? []).includes(tag);
              return (
                <label key={tag} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="identity_tags"
                    value={tag}
                    defaultChecked={checked}
                    className="border-black"
                  />
                  {tag}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Self-identified. Used only for anonymised, aggregate reporting. Never shown on your public profile.</p>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
