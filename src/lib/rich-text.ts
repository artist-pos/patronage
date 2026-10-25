/**
 * Lightweight inline rich text for profile statements.
 *
 * Stored as plain text with three markers, so every other consumer of the
 * field (meta tags, PDFs, application exports) still gets readable text:
 *   **bold**   *italic*   __underline__
 *
 * Rendering never uses dangerouslySetInnerHTML — see components/ui/RichText.tsx.
 */

export type RichNode =
  | { type: "text"; text: string }
  | { type: "bold" | "italic" | "underline"; children: RichNode[] };

const PATTERN = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*/;

export function parseRichText(input: string): RichNode[] {
  const nodes: RichNode[] = [];
  let rest = input;
  while (rest) {
    const m = PATTERN.exec(rest);
    if (!m) {
      nodes.push({ type: "text", text: rest });
      break;
    }
    if (m.index > 0) nodes.push({ type: "text", text: rest.slice(0, m.index) });
    if (m[1] !== undefined) nodes.push({ type: "bold", children: parseRichText(m[1]) });
    else if (m[2] !== undefined) nodes.push({ type: "underline", children: parseRichText(m[2]) });
    else nodes.push({ type: "italic", children: parseRichText(m[3]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

/** Plain text with the markers removed — for meta descriptions, JSON-LD, etc. */
export function stripRichText(input: string): string {
  return parseRichText(input)
    .map(function flat(n): string {
      return n.type === "text" ? n.text : n.children.map(flat).join("");
    })
    .join("");
}
