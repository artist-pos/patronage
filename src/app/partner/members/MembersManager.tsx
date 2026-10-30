"use client";

import { useEffect, useState, useTransition } from "react";
import { inviteMember, removeMember, searchProfiles, type ProfileSuggestion } from "./actions";

export interface MemberRow {
  userId: string;
  name: string;
  email: string | null;
  /** The organisation's own login. Always has access and cannot be removed. */
  isPrimary: boolean;
  isYou: boolean;
}

interface Props {
  orgId: string;
  orgName: string;
  members: MemberRow[];
}

export function MembersManager({ orgId, orgName, members }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const isHandleQuery = email.trim().startsWith("@") && email.trim().length >= 3;

  // Type "@" and a few letters to find someone already on Patronage.
  useEffect(() => {
    const q = email.trim();
    if (!q.startsWith("@") || q.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchProfiles(orgId, q);
      if (!cancelled) setSuggestions(found);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, orgId]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function invite() {
    setError(null);
    start(async () => {
      const result = await inviteMember(orgId, email);
      if (result.error) {
        setError(result.error);
        // They may still have been added, so clear the box when the error says so.
        if (result.error.startsWith("They've been added")) setEmail("");
        return;
      }
      setEmail("");
      flash("Added. We've emailed them a link to sign in.");
    });
  }

  function remove(member: MemberRow) {
    const leaving = member.isYou;
    const prompt = leaving
      ? `Leave ${orgName}? You will lose access to it.`
      : `Remove ${member.name} from ${orgName}? They will lose access.`;
    if (!window.confirm(prompt)) return;
    setError(null);
    start(async () => {
      const result = await removeMember(orgId, member.userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (leaving) {
        window.location.assign("/dashboard");
        return;
      }
      flash(`${member.name} has been removed.`);
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Add a member</h2>
        <p className="max-w-xl text-sm text-stone-600">
          Everyone here has full access to {orgName}: its profile and settings, listings, applications, artists and
          payments. Only add people you trust with all of that.
        </p>
        <form
          className="flex max-w-xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            invite();
          }}
        >
          <div className="relative flex-1">
            <input
              type="text"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="@username or name@example.com"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-black"
            />
            {isHandleQuery && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-white shadow-md">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(`@${s.username}`);
                        setSuggestions([]);
                      }}
                      className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
                    >
                      <span className="font-medium">@{s.username}</span>
                      {s.full_name && <span className="truncate text-xs text-stone-500">{s.full_name}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="h-10 rounded-lg bg-black px-5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add member"}
          </button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {toast && <p className="text-sm text-emerald-700">{toast}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Members ({members.length})
        </h2>
        <ul className="max-w-xl divide-y divide-border rounded-xl border border-border bg-white">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {m.name}
                  {m.isYou && <span className="ml-2 text-xs font-normal text-stone-400">You</span>}
                </span>
                {m.email && <span className="block truncate text-xs text-stone-500">{m.email}</span>}
              </span>
              {m.isPrimary ? (
                <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                  Organisation login
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(m)}
                  disabled={pending}
                  className="shrink-0 text-xs text-stone-500 underline underline-offset-2 hover:text-black disabled:opacity-50"
                >
                  {m.isYou ? "Leave" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
