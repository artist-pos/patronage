"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CombinedLocationPicker } from "@/components/profile/CombinedLocationPicker";
import { DisciplineInput } from "@/components/profile/DisciplineInput";
import { MediumInput } from "@/components/profile/MediumInput";
import { ORG_CATEGORIES } from "@/lib/org-categories";
import { completeOnboarding, type OnboardingResult } from "@/actions/onboarding";
import type { CityWithRegion, LocalBoard } from "@/types/database";

const ROLES = [
  {
    value: "artist",
    label: "I'm an artist",
    description: "Build your profile, find opportunities, share your practice.",
  },
  {
    value: "patron",
    label: "I support artists",
    description: "Follow artists, collect work, discover new practices.",
  },
  {
    value: "partner",
    label: "I represent an organisation",
    description: "List opportunities and reach artists directly.",
  },
] as const;

interface Props {
  /** Role already on this user's profile — skip role selection if set. */
  existingRole: string | null;
  /** Pre-highlighted role on the role-selection step. */
  suggestedRole: string;
  onComplete: (destination: string) => void;
}

export function OnboardingModal({ existingRole, suggestedRole, onComplete }: Props) {
  const router = useRouter();

  // Step tracking
  const showRoleStep = !existingRole;
  const [step, setStep] = useState<"role" | "profile">(showRoleStep ? "role" : "profile");
  const [selectedRole, setSelectedRole] = useState(existingRole ?? suggestedRole);

  // Location picker data (fetched client-side)
  const [cities, setCities] = useState<CityWithRegion[]>([]);
  const [boards, setBoards] = useState<LocalBoard[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("cities")
        .select("id, region_id, slug, name, name_maori, aliases, is_major, created_at, region:regions!cities_region_id_fkey (id, slug, name, name_maori)")
        .order("name"),
      supabase
        .from("local_boards")
        .select("id, region_id, slug, name, name_maori")
        .order("name"),
    ]).then(([{ data: c }, { data: b }]) => {
      if (c) setCities(c as unknown as CityWithRegion[]);
      if (b) setBoards(b as LocalBoard[]);
    });
  }, []);

  // Form action
  const [state, formAction, pending] = useActionState<OnboardingResult, FormData>(
    completeOnboarding,
    {}
  );

  // Navigate on success
  useEffect(() => {
    if (state.destination) {
      onComplete(state.destination);
      router.push(state.destination);
    }
  }, [state.destination, onComplete, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-background border border-black overflow-y-auto max-h-[92svh]">
        <div className="p-6 sm:p-8 space-y-8">
          {/* Step indicator */}
          {showRoleStep && (
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
              Step {step === "role" ? "1" : "2"} of 2
            </p>
          )}

          {step === "role" ? (
            <RoleStep
              selected={selectedRole}
              onSelect={(r) => setSelectedRole(r)}
              onContinue={() => setStep("profile")}
            />
          ) : (
            <ProfileStep
              role={selectedRole}
              showBack={showRoleStep}
              onBack={() => setStep("role")}
              formAction={formAction}
              pending={pending}
              error={state.error}
              cities={cities}
              boards={boards}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Role selection step ---

interface RoleStepProps {
  selected: string;
  onSelect: (role: string) => void;
  onContinue: () => void;
}

function RoleStep({ selected, onSelect, onContinue }: RoleStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">How will you use Patronage?</h2>
        <p className="text-sm text-muted-foreground">This can&apos;t be changed later.</p>
      </div>

      <div className="space-y-2">
        {ROLES.map(({ value, label, description }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={`w-full text-left border p-4 space-y-0.5 transition-colors ${
              selected === value
                ? "border-black bg-muted/40"
                : "border-border hover:border-black"
            }`}
          >
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground leading-snug">{description}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full bg-black px-4 py-2.5 text-sm text-white hover:opacity-80 transition-opacity"
      >
        Continue →
      </button>
    </div>
  );
}

// --- Profile step ---

interface ProfileStepProps {
  role: string;
  showBack: boolean;
  onBack: () => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  cities: CityWithRegion[];
  boards: LocalBoard[];
}

function ProfileStep({ role, showBack, onBack, formAction, pending, error, cities, boards }: ProfileStepProps) {
  const isArtist = role === "artist";
  const isPartner = role === "partner";

  const title = isArtist
    ? "Almost there"
    : isPartner
      ? "About your organisation"
      : "Where are you based?";

  const subtitle = isArtist
    ? "Your discipline and location power the opportunity matching."
    : isPartner
      ? "So artists can find the right opportunities."
      : "We'll personalise your experience based on where you are.";

  const submitLabel = isArtist
    ? "Find opportunities"
    : isPartner
      ? "Go to your dashboard"
      : "Start exploring";

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="role" value={role} />

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Partner: org type */}
      {isPartner && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Type of organisation</p>
          <div className="space-y-2">
            {ORG_CATEGORIES.map(({ value, label, hint }) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 border border-border p-3 transition-colors hover:border-black has-[:checked]:border-black has-[:checked]:bg-muted/40"
              >
                <input
                  type="radio"
                  name="org_category"
                  value={value}
                  required
                  className="mt-0.5 accent-black"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Artist: disciplines */}
      {isArtist && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Disciplines <span className="text-destructive">*</span>
          </p>
          <DisciplineInput />
        </div>
      )}

      {/* Location (all roles) */}
      <CombinedLocationPicker
        cities={cities}
        boards={boards}
        defaultCityId={null}
        defaultFreeform=""
        defaultCountry=""
        defaultRegionId={null}
        defaultLocalBoardId={null}
        required
      />

      {/* Patron: taste (optional) */}
      {!isArtist && !isPartner && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            What do you love? <span className="text-xs">(optional)</span>
          </p>
          <MediumInput defaultValue={[]} />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            ← Change role
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-black px-4 py-2.5 text-sm text-white hover:opacity-80 transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
