"use client";

import { useActionState } from "react";
import { upsertProfileAction, type ProfileFormState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediumInput } from "./MediumInput";
import type { Profile } from "@/types/database";

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
        <Label htmlFor="bio">Bio</Label>
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
      </div>

      <div className="space-y-2">
        <Label>{isArtist ? "Medium" : "Taste"}</Label>
        <MediumInput defaultValue={profile?.medium ?? []} />
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

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
