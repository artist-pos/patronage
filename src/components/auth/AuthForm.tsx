"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { signInAction, signUpAction } from "@/app/auth/actions";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";

const CAPTCHA_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface Props {
  mode: "login" | "signup";
  next?: string;
  /** Role chosen at signup — carried to the auth callback as a top-level param. */
  role?: string;
  /** Prefilled address, used when an invitation already named it. Editable: the
   *  artist may prefer a different one to the one their organisation had. */
  initialEmail?: string;
  /** Overrides the submit button's classes — e.g. a growth-surface embed that
   *  wants its own accent colour instead of the default button style. */
  submitClassName?: string;
  /** Overrides the submit button's label (only while not loading). */
  submitLabel?: string;
  /** Which surface rendered this form (e.g. "opportunities_grid_modal") —
   *  when set, tags a `signup_form_submitted` event so that surface's
   *  own funnel can be queried without joining through PostHog. */
  analyticsSource?: string;
  /** Signup only — when set, an "Already have an account? Sign in" line links here. */
  loginHref?: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  terms?: string;
}

const NETWORK_ERROR_MSG =
  "Couldn't reach the server. Check your connection and try again.";

// Server action invocations reject with a fetch TypeError when the user's
// connection drops mid-request. Retry once before surfacing the error.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

export function AuthForm({ mode, next = "/profile/edit", role, initialEmail, submitClassName, submitLabel, analyticsSource, loginHref }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const loadedAt = useFormLoadedAt();

  const supabase = createClient();

  // Carry both the post-auth destination and the chosen role through the auth
  // redirect. Role is a top-level param (not nested in `next`) so it survives
  // the OAuth provider round-trip via /auth/callback (PKCE code flow). Email
  // signup builds its /auth/confirm URL server-side in signUpAction.
  function buildAuthUrl(path: "/auth/callback") {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (next) params.set("next", next);
    return `${location.origin}${path}?${params.toString()}`;
  }

  /** Where a password signup goes once Supabase returns a session directly.
   *  Mirrors /auth/callback: the role travels as a top-level param so the
   *  role step can apply it without asking again, and a real resume target
   *  rides alongside it. An onboarding path is not a resume target. */
  function signupDestination(): string {
    if (!role) return next;
    const params = new URLSearchParams({ role });
    if (next && next.startsWith("/") && !next.startsWith("/onboarding")) {
      params.set("next", next);
    }
    return `/onboarding/role?${params.toString()}`;
  }

  function validate(): boolean {
    const errs: FieldErrors = {};
    if (mode === "signup") {
      if (!name.trim()) errs.name = "Enter your name.";
      if (!agreed) errs.terms = "Agree to the terms and privacy policy to continue.";
    }
    if (!email.trim()) {
      errs.email = "Enter your email address.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) {
      errs.password = "Enter a password.";
    } else if (mode === "signup" && password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthUrl("/auth/callback"),
      },
    });
    if (!error && mode === "signup" && analyticsSource) {
      trackEvent("signup_form_submitted", { source: analyticsSource, method: "google" });
    }
    if (error) {
      // "Load failed" / "Failed to fetch" are the browser's raw network
      // errors — translate them for humans.
      setError(/load failed|failed to fetch|network/i.test(error.message)
        ? NETWORK_ERROR_MSG
        : error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google — no further action needed
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);

    // Auth runs through same-origin server actions — direct browser→Supabase
    // fetches fail behind content blockers and some in-app browsers.
    try {
      if (mode === "signup") {
        const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
        const result = await withRetry(() =>
          signUpAction({
            email, password, role, next, turnstileToken, loadedAt,
            name: name.trim(), acceptedTerms: agreed,
            [HONEYPOT_FIELD]: honeypot,
          })
        );
        if (result.error) {
          setError(result.error);
        } else {
          // Signup now returns a session (190), so the account is usable
          // immediately and the address is proved afterwards from the
          // banner. Captured separately from signup_completed, which fires
          // once the role step has written the profile.
          posthog.capture("signup_submitted", { role: role ?? "" });
          if (analyticsSource) {
            trackEvent("signup_form_submitted", { source: analyticsSource, method: "password" });
          }
          // No router.refresh() here — push() already fetches fresh server
          // data for the destination. /onboarding/role writes the profile's
          // role as a side effect of rendering (so a pre-selected role can
          // skip the picker UI), so an extra refresh() fired in the same
          // tick can race it with a second request to that same URL: one
          // request's read lands before the other's write, its own
          // already-onboarded guard fires, and that response can win the
          // render — landing on /settings instead of the onboarding step
          // that just ran moments earlier.
          router.push(
            result.needsEmailConfirmation
              ? `/auth/verify?email=${encodeURIComponent(email)}${role ? `&role=${encodeURIComponent(role)}` : ""}`
              : signupDestination()
          );
          return;
        }
      } else {
        const result = await withRetry(() => signInAction({ email, password, next }));
        if (result.error) {
          setError(result.error);
        } else {
          router.push(result.redirectTo ?? next);
          return;
        }
      }
    } catch {
      setError(NETWORK_ERROR_MSG);
    }

    setLoading(false);
  }

  const googleBlock = (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={loading}
    >
      Continue with Google
    </Button>
  );

  const dividerBlock = (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 border-t border-border" />
      <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );

  const nameFieldCls = (err?: string) => (err ? "border-destructive focus-visible:border-destructive" : undefined);

  return (
    <div className="space-y-5">
      {/* Login leads with Google; signup leads with the form and puts Google after. */}
      {mode === "login" && (
        <>
          {googleBlock}
          {dividerBlock}
        </>
      )}

      {/* Email / password */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
              }}
              placeholder="The name on your profile"
              aria-invalid={!!fieldErrors.name}
              className={nameFieldCls(fieldErrors.name)}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={fieldErrors.email ? "border-destructive focus-visible:border-destructive" : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
            placeholder={mode === "signup" ? "" : "••••••••"}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={fieldErrors.password ? "border-destructive focus-visible:border-destructive" : undefined}
          />
          {fieldErrors.password ? (
            <p id="password-error" className="text-xs text-destructive">{fieldErrors.password}</p>
          ) : mode === "signup" ? (
            <p className="text-xs text-muted-foreground">Must be at least 8 characters long.</p>
          ) : null}
        </div>
        {mode === "signup" && (
          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (fieldErrors.terms) setFieldErrors((f) => ({ ...f, terms: undefined }));
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-black"
              />
              <span className="text-sm">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-2">terms of service</Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-2">privacy policy</Link>.
                <span className="block text-xs text-muted-foreground mt-1">
                  We&rsquo;ll also email you occasionally about new opportunities and Patronage itself. Every email has an unsubscribe link.
                </span>
              </span>
            </label>
            {fieldErrors.terms && <p className="text-xs text-destructive">{fieldErrors.terms}</p>}
          </div>
        )}
        {mode === "signup" && <HoneypotField />}
        {mode === "signup" && <TurnstileWidget onVerify={setTurnstileToken} />}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          className={submitClassName ?? "w-full"}
          disabled={loading || (mode === "signup" && CAPTCHA_CONFIGURED && !turnstileToken)}
        >
          {loading
            ? "Please wait…"
            : submitLabel ?? (mode === "signup" ? "Create account" : "Sign in")}
        </Button>
      </form>

      {mode === "signup" && (
        <>
          {loginHref && (
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={loginHref} className="underline underline-offset-2 text-foreground">Sign in</Link>
            </p>
          )}
          {dividerBlock}
          {googleBlock}
          <p className="text-center text-xs text-muted-foreground">
            By continuing with Google you agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">terms</Link> and{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">privacy policy</Link>.
            We&rsquo;ll email you occasionally about Patronage; you can stop that at any time.
          </p>
        </>
      )}
    </div>
  );
}
