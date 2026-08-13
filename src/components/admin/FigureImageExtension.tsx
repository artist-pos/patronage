"use client";

import {
  Node,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

/** Width steps a body figure can take. Absent attribute = "full". */
export type FigureSize = "s" | "m" | "l" | "full";

const SIZE_STEPS: { value: FigureSize; label: string; title: string }[] = [
  { value: "s", label: "S", title: "Small — 40% of the column" },
  { value: "m", label: "M", title: "Medium — 60% of the column" },
  { value: "l", label: "L", title: "Large — 80% of the column" },
  { value: "full", label: "F", title: "Full column width" },
];

/** Most images one row can hold before it stops being readable. */
export const MAX_ROW_FIGURES = 3;

/** Aspect ratio, used as the flex weight so a row's images share a baseline. */
function aspectRatio(width: unknown, height: unknown): number | null {
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!width || !height) return null;
  return width / height;
}

function parseDimension(value: string | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * In-line blog image with a caption, a width step, and optional pairing into a
 * side-by-side row (see `FigureRow` below).
 *
 * Serialises to plain `<figure data-figure-image data-size><img><figcaption>`
 * HTML so the published post can keep rendering `post.body` with
 * dangerouslySetInnerHTML — no schema column, no separate table. `parseHTML`
 * mirrors `renderHTML` exactly so an existing post round-trips back into the
 * editor unchanged; posts written before sizing existed parse as "full".
 *
 * Widths themselves live in globals.css keyed off the data attributes, so the
 * editor, the admin preview and the published post all size a figure the same.
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
      size: { default: "full" },
      // Natural dimensions of the stored file — drives the intrinsic img
      // width/height (no layout shift) and the row flex weight.
      width: { default: null },
      height: { default: null },
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
            size: element.getAttribute("data-size") ?? "full",
            width: parseDimension(img.getAttribute("width")),
            height: parseDimension(img.getAttribute("height")),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const caption = (node.attrs.caption as string | null) ?? "";
    const size = (node.attrs.size as FigureSize) ?? "full";
    const ratio = aspectRatio(node.attrs.width, node.attrs.height);

    const img = [
      "img",
      {
        src: node.attrs.src as string,
        // Caption doubles as alt text when no explicit alt was set.
        alt: (node.attrs.alt as string | null) ?? caption,
        loading: "lazy",
        ...(ratio
          ? {
              width: String(node.attrs.width),
              height: String(node.attrs.height),
            }
          : {}),
      },
    ];

    const figureAttrs = {
      "data-figure-image": "",
      // "full" is the CSS default, so leave the attribute off — old posts and
      // full-width figures then serialise to byte-identical HTML.
      ...(size !== "full" ? { "data-size": size } : {}),
      // Inert outside a row; inside one it splits the width by aspect ratio.
      ...(ratio ? { style: `flex-grow:${ratio.toFixed(3)}` } : {}),
    };

    return caption
      ? ["figure", figureAttrs, img, ["figcaption", {}, caption]]
      : ["figure", figureAttrs, img];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureImageView);
  },
});

/**
 * Two or three figures shown side by side. Serialises to
 * `<div data-figure-row>` wrapping the same figure markup, so the published
 * post needs no extra rendering path and a row degrades to stacked images if
 * the stylesheet ever fails to load.
 */
export const FigureRow = Node.create({
  name: "figureRow",
  group: "block",
  content: `figureImage{1,${MAX_ROW_FIGURES}}`,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-figure-row]" }];
  },

  renderHTML() {
    return ["div", { "data-figure-row": "" }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureRowView);
  },
});

/**
 * Where this figure sits in the document. Positions go stale between a
 * transaction and the re-render that follows it, so resolving is guarded.
 */
function figureContext(editor: Editor, node: PMNode, getPos: NodeViewProps["getPos"]) {
  try {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return { pos: null, inRow: false, next: null };
    const $pos = editor.state.doc.resolve(pos);
    const inRow = $pos.parent.type.name === "figureRow";
    const next = inRow ? null : editor.state.doc.nodeAt(pos + node.nodeSize);
    return { pos, inRow, next };
  } catch {
    return { pos: null, inRow: false, next: null };
  }
}

function FigureImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const src = node.attrs.src as string;
  const caption = (node.attrs.caption as string | null) ?? "";
  const size = (node.attrs.size as FigureSize) ?? "full";
  const ratio = aspectRatio(node.attrs.width, node.attrs.height);

  const { pos, inRow, next } = figureContext(editor, node, getPos);
  const canPair =
    next?.type.name === "figureImage" ||
    (next?.type.name === "figureRow" && next.childCount < MAX_ROW_FIGURES);

  /** Folds this figure and the one (or row) after it into a side-by-side row. */
  function pairWithNext() {
    if (pos == null) return;
    const { state, view } = editor;
    const self = state.doc.nodeAt(pos);
    if (self?.type.name !== "figureImage") return;
    const afterPos = pos + self.nodeSize;
    const sibling = state.doc.nodeAt(afterPos);
    if (!sibling) return;

    const children: PMNode[] = [self];
    if (sibling.type.name === "figureImage") {
      children.push(sibling);
    } else if (sibling.type.name === "figureRow") {
      sibling.forEach((child) => children.push(child));
    } else {
      return;
    }
    if (children.length > MAX_ROW_FIGURES) return;

    view.dispatch(
      state.tr.replaceWith(
        pos,
        afterPos + sibling.nodeSize,
        state.schema.nodes.figureRow.create(null, children)
      )
    );
  }

  /** Removing the second-to-last figure of a row unwraps the row entirely. */
  function removeSelf() {
    if (!inRow || pos == null) {
      deleteNode();
      return;
    }
    const { state, view } = editor;
    const $pos = state.doc.resolve(pos);
    const row = $pos.parent;
    if (row.childCount > 2) {
      deleteNode();
      return;
    }
    const index = $pos.index();
    const kept: PMNode[] = [];
    row.forEach((child, _offset, i) => {
      if (i !== index) kept.push(child);
    });
    const rowStart = $pos.before();
    view.dispatch(state.tr.replaceWith(rowStart, rowStart + row.nodeSize, kept));
  }

  return (
    <NodeViewWrapper
      as="figure"
      data-figure-image=""
      data-size={size === "full" ? undefined : size}
      style={ratio ? { flexGrow: ratio } : undefined}
      className="group/fig"
    >
      <div
        contentEditable={false}
        data-drag-handle
        className={`relative overflow-hidden rounded-lg border transition-colors ${
          selected ? "border-foreground" : "border-transparent"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          className="block h-auto w-full"
          // Backfills figures written before dimensions were recorded, so an
          // old image can still be paired into a height-matched row. Fires
          // once: the attribute update sets `ratio`, and the src never changes.
          onLoad={(e) => {
            if (ratio) return;
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth && naturalHeight) {
              updateAttributes({ width: naturalWidth, height: naturalHeight });
            }
          }}
        />

        <div className="absolute right-1.5 top-1.5 flex flex-wrap items-center justify-end gap-1 opacity-0 transition-opacity group-hover/fig:opacity-100">
          {/* Width steps are meaningless inside a row — the row splits the
              column by aspect ratio instead. */}
          {!inRow && (
            <div className="flex items-center overflow-hidden rounded bg-black/60">
              {SIZE_STEPS.map((step) => (
                <button
                  key={step.value}
                  type="button"
                  title={step.title}
                  onClick={() => updateAttributes({ size: step.value })}
                  className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    size === step.value
                      ? "bg-white text-black"
                      : "text-white hover:bg-white/20"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
          )}
          {canPair && (
            <button
              type="button"
              title="Place side by side with the image below"
              onClick={pairWithNext}
              className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-black/80"
            >
              ⇄ Pair
            </button>
          )}
          <button
            type="button"
            title="Remove image"
            onClick={removeSelf}
            className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-black/80"
          >
            Remove
          </button>
        </div>
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

function FigureRowView({ node, editor, getPos }: NodeViewProps) {
  /** Puts each figure of the row back on its own line, sizes intact. */
  function breakApart() {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return;
    const { state, view } = editor;
    const row = state.doc.nodeAt(pos);
    if (row?.type.name !== "figureRow") return;
    const children: PMNode[] = [];
    row.forEach((child) => children.push(child));
    view.dispatch(state.tr.replaceWith(pos, pos + row.nodeSize, children));
  }

  return (
    <NodeViewWrapper as="div" className="group/row relative">
      <div
        contentEditable={false}
        className="absolute -top-2 right-0 z-10 opacity-0 transition-opacity group-hover/row:opacity-100"
      >
        <button
          type="button"
          title={`Stack these ${node.childCount} images back onto their own lines`}
          onClick={breakApart}
          className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-black/80"
        >
          Unpair
        </button>
      </div>
      <NodeViewContent as="div" data-figure-row="" />
    </NodeViewWrapper>
  );
}
