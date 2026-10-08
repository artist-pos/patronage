"use client";

import { useState, useTransition } from "react";
import { setOrgCategory, updateProfileBasics } from "@/app/admin/profiles/actions";
import { ORG_CATEGORIES, canKeepRoster } from "@/lib/org-categories";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";

interface Props {
  profileId: string;
  /** Set for organisations only: their current type and how many roster entries they have. */
  orgType: { value: string; rosterCount: number } | null;
  defaults: { full_name: string; bio: string; website_url: string; username: string };
}

export function AdminProfileEditor({ profileId, orgType, defaults }: Props) {
  const [category, setCategory] = useState(orgType?.value ?? "");
  const [categorySaved, setCategorySaved] = useState(orgType?.value ?? "");
  const [categoryMessage, setCategoryMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [categoryPending, startCategory] = useTransition();

  function saveCategory() {
    setCategoryMessage(null);
    startCategory(async () => {
      const res = await setOrgCategory(profileId, category || null);
      if (res.error) {
        setCategoryMessage({ text: res.error, ok: false });
      } else {
        setCategorySaved(category);
        setCategoryMessage({ text: "Saved.", ok: true });
      }
    });
  }

  const [fullName, setFullName] = useState(defaults.full_name);
  const [username, setUsername] = useState(defaults.username);
  const [bio, setBio] = useState(defaults.bio);
  const [website, setWebsite] = useState(defaults.website_url);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateProfileBasics(profileId, {
        full_name: fullName,
        bio,
        website_url: website,
        username,
      });
      if (res.username) setUsername(res.username);
      setMessage(res.error ? { text: res.error, ok: false } : { text: "Saved.", ok: true });
    });
  }

  const inputCls =
    "w-full border border-black bg-background px-3 py-2 text-sm focus-visible:outline-none";
  const labelCls = "text-xs font-medium uppercase tracking-widest text-stone-400";

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="pe-name" className={labelCls}>Name</label>
          <input id="pe-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pe-username" className={labelCls}>Page URL</label>
          <div className="flex items-center border border-black bg-background text-sm">
            <span className="pl-3 text-stone-400">patronage.nz/</span>
            <input
              id="pe-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              className="w-full bg-transparent py-2 pr-3 focus-visible:outline-none"
            />
          </div>
          {username !== defaults.username && (
            <p className="text-xs text-muted-foreground">
              Links already shared to the old URL will stop working.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pe-bio" className={labelCls}>Bio</label>
          <textarea
            id="pe-bio"
            rows={8}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pe-web" className={labelCls}>Website</label>
          <input
            id="pe-web"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          {message && (
            <span className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>
          )}
        </div>
      </form>

      {orgType && (
        <section className="space-y-3 border-t border-border pt-6">
          <label htmlFor="pe-category" className={labelCls}>Organisation type</label>
          <select
            id="pe-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">Not set</option>
            {ORG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {category !== categorySaved && orgType.rosterCount > 0 && !canKeepRoster(category) && (
            <p className="text-xs text-amber-700">
              This organisation has {orgType.rosterCount} roster {orgType.rosterCount === 1 ? "entry" : "entries"}. The new type
              cannot add to it, though existing entries stay linked.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveCategory}
              disabled={categoryPending || category === categorySaved}
              className="bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {categoryPending ? "Saving…" : "Save type"}
            </button>
            {categoryMessage && (
              <span className={`text-xs ${categoryMessage.ok ? "text-green-700" : "text-red-600"}`}>{categoryMessage.text}</span>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3 border-t border-border pt-6">
        <p className={labelCls}>Logo / avatar</p>
        <AvatarUploader profileId={profileId} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <p className={labelCls}>Banner image</p>
        <FeaturedImageUploader profileId={profileId} />
      </section>
    </div>
  );
}
