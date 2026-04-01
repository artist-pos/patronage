"use client";

import { Bold, Italic, List } from "lucide-react";
import type { RefObject } from "react";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

type FormatAction = "bold" | "italic" | "bullet";

function applyFormat(
  textarea: HTMLTextAreaElement,
  action: FormatAction,
  onChange: (value: string) => void
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  let replacement: string;
  let newCursorStart: number;
  let newCursorEnd: number;

  if (action === "bold") {
    if (selected) {
      replacement = `**${selected}**`;
      newCursorStart = start;
      newCursorEnd = start + replacement.length;
    } else {
      replacement = "****";
      newCursorStart = start + 2;
      newCursorEnd = start + 2;
    }
    onChange(before + replacement + after);
  } else if (action === "italic") {
    if (selected) {
      replacement = `_${selected}_`;
      newCursorStart = start;
      newCursorEnd = start + replacement.length;
    } else {
      replacement = "__";
      newCursorStart = start + 1;
      newCursorEnd = start + 1;
    }
    onChange(before + replacement + after);
  } else {
    // bullet: prefix each selected line with "- "
    const lines = selected
      ? selected.split("\n").map((l) => (l.trim() ? `- ${l}` : l))
      : ["- "];
    replacement = lines.join("\n");
    newCursorStart = start;
    newCursorEnd = start + replacement.length;
    onChange(before + replacement + after);
  }

  // Restore focus + selection after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorStart, newCursorEnd);
  });
}

const BTN =
  "p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors";

export function DescriptionToolbar({ textareaRef, onChange }: Props) {
  function handle(action: FormatAction) {
    if (!textareaRef.current) return;
    applyFormat(textareaRef.current, action, onChange);
  }

  return (
    <div className="flex items-center gap-0.5 border border-black border-b-0 bg-stone-50 px-1.5 py-1">
      <button type="button" onClick={() => handle("bold")} className={BTN} title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => handle("italic")} className={BTN} title="Italic">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-3.5 bg-stone-200 mx-0.5" />
      <button type="button" onClick={() => handle("bullet")} className={BTN} title="Bullet list">
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
