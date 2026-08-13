"use client";

import {
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

/**
 * In-line blog image with a caption.
 *
 * Serialises to plain `<figure data-figure-image><img><figcaption>` HTML so the
 * published post can keep rendering `post.body` with dangerouslySetInnerHTML —
 * no schema column, no separate table. `parseHTML` mirrors `renderHTML` exactly
 * so an existing post round-trips back into the editor unchanged.
 */
export const FigureImage = Node.create({
  name: "figureImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      caption: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-figure-image]",
        getAttrs: (element: HTMLElement) => {
          const img = element.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            caption: element.querySelector("figcaption")?.textContent ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const caption = (node.attrs.caption as string | null) ?? "";
    const img = [
      "img",
      {
        src: node.attrs.src as string,
        // Caption doubles as alt text when no explicit alt was set.
        alt: (node.attrs.alt as string | null) ?? caption,
        loading: "lazy",
      },
    ];
    return caption
      ? ["figure", { "data-figure-image": "" }, img, ["figcaption", {}, caption]]
      : ["figure", { "data-figure-image": "" }, img];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureImageView);
  },
});

function FigureImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const src = node.attrs.src as string;
  const caption = (node.attrs.caption as string | null) ?? "";

  return (
    <NodeViewWrapper as="figure" className="my-4">
      <div
        contentEditable={false}
        data-drag-handle
        className={`relative group overflow-hidden rounded-lg border transition-colors ${
          selected ? "border-foreground" : "border-transparent"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption} className="block h-auto w-full" />
        <button
          type="button"
          onClick={() => deleteNode()}
          className="absolute right-2 top-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          Remove
        </button>
      </div>
      <div contentEditable={false}>
        <input
          type="text"
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          // Keystrokes inside the input must not reach ProseMirror's handlers.
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Add a caption…"
          className="mt-1.5 w-full border-0 border-b border-dashed border-stone-200 bg-transparent py-1 text-xs text-stone-600 transition-colors placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
        />
      </div>
    </NodeViewWrapper>
  );
}
