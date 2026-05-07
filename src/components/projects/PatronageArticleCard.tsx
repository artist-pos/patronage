import { Instagram } from "lucide-react";

interface Props {
  articleUrl: string;
}

export function PatronageArticleCard({ articleUrl }: Props) {
  return (
    <div className="border border-border bg-stone-50">
      <a
        href={articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between px-4 py-3.5 group hover:bg-stone-100 transition-colors"
      >
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-widest font-mono text-stone-400">Patronage Blog</p>
          <p className="text-sm font-medium group-hover:underline underline-offset-2">
            Read the full article →
          </p>
        </div>
        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-stone-400">
            <path d="M2 12L12 2M12 2H5M12 2V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </a>
      <div className="border-t border-border px-4 py-2.5">
        <a
          href="https://www.instagram.com/patronage.nz/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Instagram className="w-3.5 h-3.5 shrink-0" />
          <span>@patronage.nz on Instagram</span>
        </a>
      </div>
    </div>
  );
}
