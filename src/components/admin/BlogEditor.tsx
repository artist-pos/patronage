"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { upsertPost } from "@/app/admin/blog/actions";

interface Post {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
}

interface Props {
  post?: Post;
  userId: string;
}

type ToolbarItem =
  | { type: "action"; label: string; action: () => void; active: boolean }
  | { type: "separator" };

export function BlogEditor({ post, userId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(post?.title ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(post?.image_url ?? null);
  const [status, setStatus] = useState<"draft" | "published">(
    post?.status ?? "draft"
  );
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline text-blue-600 hover:opacity-80" },
      }),
    ],
    content: post?.body ?? "",
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[320px] px-4 py-3 text-sm leading-relaxed",
      },
    },
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/blog/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("portfolio")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("portfolio")
      .getPublicUrl(path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
  }

  function save(targetStatus: "draft" | "published") {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    startTransition(async () => {
      const result = await upsertPost({
        id: post?.id,
        existingSlug: post?.slug,
        title: title.trim(),
        body: editor?.getHTML() ?? "",
        image_url: imageUrl,
        status: targetStatus,
        existingPublishedAt: post?.published_at,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatus(targetStatus);
      showToast(
        targetStatus === "published" ? "Post published." : "Draft saved."
      );

      // If new post, navigate to the edit page so subsequent saves update the same row
      if (!post?.id && result.id) {
        router.push(`/admin/blog/${result.id}/edit`);
      }
    });
  }

  const toolbarItems: ToolbarItem[] = editor
    ? [
        {
          type: "action",
          label: "B",
          action: () => editor.chain().focus().toggleBold().run(),
          active: editor.isActive("bold"),
        },
        {
          type: "action",
          label: "I",
          action: () => editor.chain().focus().toggleItalic().run(),
          active: editor.isActive("italic"),
        },
        { type: "separator" },
        {
          type: "action",
          label: "H1",
          action: () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
          active: editor.isActive("heading", { level: 1 }),
        },
        {
          type: "action",
          label: "H2",
          action: () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
          active: editor.isActive("heading", { level: 2 }),
        },
        {
          type: "action",
          label: "H3",
          action: () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
          active: editor.isActive("heading", { level: 3 }),
        },
        { type: "separator" },
        {
          type: "action",
          label: "Bullets",
          action: () => editor.chain().focus().toggleBulletList().run(),
          active: editor.isActive("bulletList"),
        },
        {
          type: "action",
          label: "Numbered",
          action: () => editor.chain().focus().toggleOrderedList().run(),
          active: editor.isActive("orderedList"),
        },
        { type: "separator" },
        {
          type: "action",
          label: "Link",
          action: () => {
            const url = window.prompt("Enter URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          },
          active: editor.isActive("link"),
        },
        {
          type: "action",
          label: "Unlink",
          action: () => editor.chain().focus().unsetLink().run(),
          active: false,
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="w-full text-xl font-semibold border-0 border-b border-border bg-transparent py-2 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300"
        />
      </div>

      {/* Featured Image */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Featured Image
        </label>
        {imageUrl ? (
          <div className="relative group">
            <img
              src={imageUrl}
              alt=""
              className="w-full max-h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-stone-200 rounded-xl py-10 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Click to upload featured image"}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Rich Text Editor */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Body
        </label>
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-stone-50">
            {toolbarItems.map((item, i) => {
              if (item.type === "separator") {
                return (
                  <span
                    key={`sep-${i}`}
                    className="mx-1 h-4 w-px bg-stone-200"
                  />
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    item.active
                      ? "bg-black text-white"
                      : "hover:bg-stone-200 text-stone-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Status
        </label>
        <div className="flex gap-2">
          {(["draft", "published"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors capitalize ${
                status === s
                  ? "bg-black text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={isPending}
          className="text-sm font-medium px-5 py-2.5 rounded-lg border border-border hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => save("published")}
          disabled={isPending}
          className="text-sm font-medium px-5 py-2.5 rounded-lg bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Publish"}
        </button>
      </div>
    </div>
  );
}
