import { parseRichText, type RichNode } from "@/lib/rich-text";

function render(nodes: RichNode[]): React.ReactNode {
  return nodes.map((n, i) => {
    if (n.type === "text") return n.text;
    const inner = render(n.children);
    if (n.type === "bold") return <strong key={i} className="font-semibold">{inner}</strong>;
    if (n.type === "italic") return <em key={i}>{inner}</em>;
    return <u key={i} className="underline-offset-2">{inner}</u>;
  });
}

/** Renders **bold**, *italic* and __underline__ markers as real elements. */
export function RichText({ text }: { text: string }) {
  return <>{render(parseRichText(text))}</>;
}
