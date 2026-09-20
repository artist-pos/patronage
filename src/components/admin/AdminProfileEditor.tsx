"use client";

import { useState, useTransition } from "react";
import { updateProfileBasics } from "@/app/admin/profiles/actions";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { FeaturedImageUploader } from "@/components/profile/FeaturedImageUploader";

interface Props {
  profileId: string;
  defaults: { full_name: string; bio: string; website_url: string };
}

export function AdminProfileEditor({ profileId, defaults }: Props) {
  const [fullName, setFullName] = useState(defaults.full_name);
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
      });
      setMessage(res.error ? { text: res.error, ok: false } : { text: "Saved.", ok: true });
    });
  }

  const inputCls =
    "w-full border border-black bg-background px-3 py-2 text-sm focus-visible:outline-none";
  const labelCls = "text-[10px] font-medium uppercase tracking-widest text-stone-400";

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="pe-name" className={labelCls}>Name</label>
          <input id="pe-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
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
