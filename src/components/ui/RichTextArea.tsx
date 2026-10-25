"use client";

import { useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";

interface Props {
  id: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}

const ACTIONS = [
  { label: "Bold", marker: "**", key: "b", Icon: Bold },
  { label: "Italic", marker: "*", key: "i", Icon: Italic },
  { label: "Underline", marker: "__", key: "u", Icon: Underline },
] as const;

function autosize(t: HTMLTextAreaElement) {
  t.style.height = "auto";
  t.style.height = `${t.scrollHeight}px`;
}

/** Textarea with a bold / italic / underline toolbar. Stores plain text with markers (see lib/rich-text). */
export function RichTextArea({ id, name, defaultValue = "", rows = 4, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string) {
    const t = ref.current;
    if (!t) return;
    const { selectionStart: s, selectionEnd: e, value } = t;
    const selected = value.slice(s, e);
    const already = value.slice(s - marker.length, s) === marker && value.slice(e, e + marker.length) === marker;
    let next: string;
    let from: number;
    let to: number;
    if (already) {
      next = value.slice(0, s - marker.length) + selected + value.slice(e + marker.length);
      from = s - marker.length;
      to = e - marker.length;
    } else {
      next = value.slice(0, s) + marker + selected + marker + value.slice(e);
      from = s + marker.length;
      to = e + marker.length;
    }
    t.value = next;
    t.setSelectionRange(from, to);
    t.focus();
    autosize(t);
  }

  return (
    <div>
      <div className="flex gap-1 border border-b-0 border-black bg-background px-1 py-1">
        {ACTIONS.map(({ label, marker, Icon }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => wrap(marker)}
            className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none overflow-hidden border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
        onInput={(e) => autosize(e.currentTarget)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          const a = ACTIONS.find((x) => x.key === e.key.toLowerCase());
          if (a) {
            e.preventDefault();
            wrap(a.marker);
          }
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Select text, then use the buttons or Ctrl/⌘ + B, I, U.
      </p>
    </div>
  );
}
