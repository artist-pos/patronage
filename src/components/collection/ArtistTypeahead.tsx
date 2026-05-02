"use client";

import { useEffect, useState } from "react";
import { searchProfiles } from "@/app/dashboard/collection/actions";

export interface ArtistSelection {
  text: string;
  profileId: string | null;
}

interface Props {
  value: ArtistSelection;
  onChange: (selection: ArtistSelection) => void;
}

interface ProfileSuggestion {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * Free-text artist input with a Patronage profile typeahead. If the holder
 * picks a suggestion, profileId is set so Phase 2's confirmation loop can
 * route directly to that artist. Otherwise the free-text persists as
 * attributed_artist_text and Phase 2 creates a stub.
 */
export function ArtistTypeahead({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    // Skip lookup once the holder has locked in a profile pick — re-typing the
    // same name shouldn't re-open the list. Setting empty results inside the
    // debounce keeps the effect free of synchronous setState side effects.
    let cancelled = false;
    const skip = !!value.profileId || value.text.trim().length < 2;
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (skip) {
        setSuggestions([]);
        return;
      }
      const results = await searchProfiles(value.text);
      if (!cancelled) setSuggestions(results);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value.text, value.profileId]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value.text}
        onChange={(e) => {
          // Typing always clears the locked profile id — they're editing the name.
          onChange({ text: e.target.value, profileId: null });
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => {
          // Delay so a click on a suggestion can register first.
          setTimeout(() => setShowList(false), 150);
        }}
        placeholder="Artist name"
        className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
        autoComplete="off"
      />

      {value.profileId && (
        <p className="mt-1 text-xs text-emerald-700">
          Linked to a Patronage profile.
        </p>
      )}

      {showList && suggestions.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-md shadow-sm max-h-64 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ text: s.full_name ?? s.username, profileId: s.id });
                  setShowList(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-stone-50 text-sm flex items-center gap-2"
              >
                {s.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatar_url}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-stone-200" />
                )}
                <span className="flex-1 truncate">
                  {s.full_name ?? s.username}
                </span>
                <span className="text-xs text-muted-foreground">@{s.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
