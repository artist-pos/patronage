"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  mode: "login" | "signup";
  next?: string;
  /** Role chosen at signup — carried to the auth callback as a top-level param. */
  role?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export function AuthForm({ mode, next = "/profile/edit", role }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  // Carry both the post-auth destination and the chosen role through the auth
  // redirect. Role is a top-level param (not nested in `next`) so it survives
  // the OAuth provider round-trip. OAuth uses /auth/callback (PKCE code flow);
  // email signup uses /auth/confirm (token_hash flow) so the link survives
  // email prefetch/scanners and works across devices.
  function buildAuthUrl(path: "/auth/callback" | "/auth/confirm") {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (next) params.set("next", next);
    return `${location.origin}${path}?${params.toString()}`;
  }

  function validate(): boolean {
    const errs: FieldErrors = {};
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
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google — no further action needed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: buildAuthUrl("/auth/confirm") },
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/auth/verify");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("That email and password combination didn't work. Try again or reset your password.");
      } else {
        // Check if the user has completed onboarding (has a profile row)
        const { data: { user: authedUser } } = await supabase.auth.getUser();
        if (authedUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", authedUser.id)
            .maybeSingle();
          if (!profile) {
            router.push("/onboarding/role");
            router.refresh();
            return;
          }
        }
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Email / password */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={fieldErrors.password ? "border-destructive focus-visible:border-destructive" : undefined}
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? "Please wait…"
            : mode === "signup"
            ? "Create account"
            : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
