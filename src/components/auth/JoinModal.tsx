"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { stashSignupContext } from "@/lib/signup-context.client";
import type { SignupContext } from "@/lib/signup-context";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { ORG_CATEGORIES } from "@/lib/org-categories";
import { searchCities, cityFullName } from "@/lib/regions";
import { AuthForm } from "@/components/auth/AuthForm";
import type { CityWithRegion, DisciplineEnum } from "@/types/database";

// "other" doesn't round-trip through toDisciplineEnums; see OpportunitySignupModalTrigger.
const CHIP_DISCIPLINES = DISCIPLINE_OPTIONS.filter((d) => d.value !== "other");

type Role = "artist" | "partner" | "patron";
type Step = "role" | "about" | "details";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "artist", label: "I’m an artist", hint: "Find opportunities and build your profile." },
  { value: "partner", label: "I’m a partner organisation", hint: "Run opportunities and find artists." },
  { value: "patron", label: "I support artists", hint: "Follow studio updates and back the artists you believe in." },
];

/** The slice of the city taxonomy the location search needs. */
export type JoinCity = Pick<CityWithRegion, "id" | "name" | "name_maori" | "aliases" | "is_major" | "region_id"> & {
  region: { id: string; name: string } | null;
};

interface Props {
  cities: JoinCity[];
  /** Attribution for the signup context, e.g. "explore_feed_band". */
  source: string;
  onClose: () => void;
}

/**
 * Three-step signup popup: who you are → what you make (artists) or what kind
 * of organisation → name, email, location. Everything picked before the form
 * is stashed in the signup-context cookie as it changes, so it survives the
 * email and Google paths alike and /onboarding/role writes it to the profile.
 * The role itself travels on AuthForm's `role`, which skips the role picker.
 *
 * Supporters skip the middle step: onboarding stores disciplines for artists
 * only, so asking a supporter would collect an answer nothing uses.
 */
export default function JoinModal({ cities, source, onClose }: Props) {
  const pathname = usePathname();
  const titleId = useId();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplineEnum[]>([]);
  const [orgCategory, setOrgCategory] = useState<string | null>(null);
  const [place, setPlace] = useState<{ city: string; regionId?: string; country?: string } | null>(null);

  // Keep the cookie current with every answer; AuthForm owns the submit.
  useEffect(() => {
    const ctx: SignupContext = {
      source,
      ...(role && { explicitRole: role }),
      ...(role === "artist" && disciplines.length > 0 && { disciplines }),
      ...(role === "partner" && orgCategory && { orgCategory }),
      ...(place?.city && { city: place.city }),
      ...(place?.country && { country: place.country }),
      ...(place?.regionId && { regionId: place.regionId }),
    };
    try {
      const ref = sessionStorage.getItem("patronage_ref");
      if (ref) ctx.ref = ref;
    } catch {
      // Blocked storage — attribution degrades, signup still works.
    }
    stashSignupContext(ctx);
  }, [source, role, disciplines, orgCategory, place]);

  useEffect(() => {
    trackEvent("join_modal_view", { source });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    trackEvent("join_modal_dismissed", { source, step, role: role ?? "" });
    onClose();
  }

  function pickRole(r: Role) {
    setRole(r);
    trackEvent("join_modal_role", { source, role: r });
    if (r === "patron") goToDetails(r);
    else setStep("about");
  }

  // Funnel step: reached the form. Carries the middle-step answer so drop-off
  // can be read per discipline or organisation type.
  function goToDetails(r: Role, answer: Record<string, string> = {}) {
    trackEvent("join_modal_details", { source, role: r, ...answer });
    setStep("details");
  }

  function back() {
    setStep(step === "details" && role !== "patron" ? "about" : "role");
  }

  // Where each role lands after signup. Artists still pass through the profile
  // step first; onboarding honours this afterwards.
  const next =
    role === "artist" ? "/opportunities?tab=for-you" : role === "patron" ? pathname ?? "/feed" : "/partner/dashboard";

  const stepNumber = step === "role" ? 1 : step === "about" ? 2 : role === "patron" ? 2 : 3;
  const stepTotal = role === "patron" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-md" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto border border-black bg-background p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          {step === "role" ? (
            <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">Join Patronage · free</span>
          ) : (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1.5 text-[13px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            {role && (
              <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                {stepNumber} of {stepTotal}
              </span>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── 1. Who are you ── */}
        {step === "role" && (
          <>
            <p id={titleId} className="text-lg font-semibold leading-snug">
              Who are you joining as?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {ROLES.map((r, i) => (
                <button
                  key={r.value}
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => pickRole(r.value)}
                  className="border border-border px-4 py-3.5 text-left transition-colors hover:border-foreground focus-visible:border-foreground focus-visible:outline-none"
                >
                  <span className="block text-[15px] font-medium">{r.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[color:var(--fg-muted)]">{r.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── 2a. Artist: disciplines ── */}
        {step === "about" && role === "artist" && (
          <>
            <p id={titleId} className="text-lg font-semibold leading-snug">
              What do you make?
            </p>
            <p className="mt-1.5 text-sm leading-[1.55] text-muted-foreground">
              Pick a few. We&rsquo;ll match you to the grants, residencies, commissions and open calls that fit.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {CHIP_DISCIPLINES.map(({ value, label }) => {
                const active = disciplines.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDisciplines((prev) => (active ? prev.filter((d) => d !== value) : [...prev, value]))
                    }
                    className={`border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-white"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={disciplines.length === 0}
              onClick={() => goToDetails("artist", { disciplines: disciplines.join(",") })}
              className="mt-6 w-full bg-brand py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Continue →
            </button>
          </>
        )}

        {/* ── 2b. Organisation: what kind ── */}
        {step === "about" && role === "partner" && (
          <>
            <p id={titleId} className="text-lg font-semibold leading-snug">
              What kind of organisation?
            </p>
            <div className="mt-5 flex flex-col gap-1.5">
              {ORG_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setOrgCategory(c.value);
                    goToDetails("partner", { org_category: c.value });
                  }}
                  className={`border px-4 py-2.5 text-left text-[14px] transition-colors ${
                    orgCategory === c.value ? "border-foreground" : "border-border hover:border-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setOrgCategory(null);
                goToDetails("partner", { org_category: "other" });
              }}
              className="mt-3 text-[13px] text-[color:var(--fg-muted)] underline underline-offset-4 hover:text-foreground"
            >
              Something else
            </button>
          </>
        )}

        {/* ── 3. Name, email, location ── */}
        {step === "details" && role && (
          <>
            <p id={titleId} className="text-lg font-semibold leading-snug">
              Nearly there
            </p>
            <div className="mt-5">
              <PlaceField cities={cities} value={place} onChange={setPlace} />
            </div>
            <div className="mt-5 border-t border-border pt-5">
              <AuthForm
                mode="signup"
                role={role}
                next={next}
                analyticsSource={source}
                submitClassName="w-full bg-brand text-white hover:bg-brand/90"
                submitLabel="Join free →"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Location: type-to-search over the NZ taxonomy, or free text ──────────────

function PlaceField({
  cities,
  value,
  onChange,
}: {
  cities: JoinCity[];
  value: { city: string; regionId?: string; country?: string } | null;
  onChange: (v: { city: string; regionId?: string; country?: string } | null) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(value?.city ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const results = useMemo(
    () => searchCities(cities as unknown as CityWithRegion[], query, 6),
    [cities, query]
  );

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        Where are you based?
      </label>
      <input
        id={inputId}
        value={query}
        autoComplete="off"
        placeholder="Town or city"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          setOpen(true);
          // Typed text stands until a town is picked; blank clears it.
          onChange(q.trim() ? { city: q.trim() } : null);
        }}
        className="w-full border border-border bg-background px-3 py-2.5 text-[16px] transition-colors focus:border-foreground focus:outline-none sm:text-sm"
      />
      {value?.regionId && (
        <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">
          {cities.find((c) => c.region_id === value.regionId)?.region?.name}, Aotearoa
        </p>
      )}
      {open && query.trim() && (
        <div className="absolute inset-x-0 z-10 mt-1 border border-border bg-card shadow-[var(--shadow-md)]">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setQuery(c.name);
                setOpen(false);
                onChange({ city: c.name, regionId: c.region_id ?? undefined, country: "NZ" });
              }}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[color:var(--tint)]"
            >
              <span>{cityFullName(c)}</span>
              <span className="shrink-0 text-[12px] text-[color:var(--fg-muted)]">{c.region?.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange({ city: query.trim() });
            }}
            className="w-full border-t border-border px-3 py-2 text-left text-[13px] text-[color:var(--fg-muted)] hover:bg-[color:var(--tint)]"
          >
            Use &ldquo;{query.trim()}&rdquo;{results.length === 0 ? "" : " (somewhere else)"}
          </button>
        </div>
      )}
    </div>
  );
}
