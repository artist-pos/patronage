"use client";

import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Props {
  defaultValue?: string[];
}

export function MediumInput({ defaultValue = [] }: Props) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [inputVal, setInputVal] = useState("");

  function addTag(value: string) {
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
    }
    setInputVal("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === "Backspace" && !inputVal && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      {/* Hidden field carries comma-separated values to the form */}
      <input type="hidden" name="medium" value={tags.join(",")} />
      <div className="flex flex-wrap gap-2 min-h-[2.25rem] border border-border p-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="cursor-pointer select-none text-xs font-normal"
            onClick={() => removeTag(tag)}
            title="Click to remove"
          >
            {tag} ×
          </Badge>
        ))}
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => addTag(inputVal)}
          placeholder={tags.length === 0 ? "e.g. painting, sculpture — press Enter" : ""}
          className="border-0 p-0 h-auto text-sm flex-1 min-w-[120px] focus-visible:ring-0 shadow-none"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add. Click a tag to remove.
      </p>
    </div>
  );
}
