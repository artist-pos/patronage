"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

type FooterLink = { text: string; href: string; external?: boolean };
type FooterColumn = { label: string; links: FooterLink[] };

const COLUMNS: FooterColumn[] = [
  {
    label: "For Artists",
    links: [
      { text: "Browse opportunities", href: "/opportunities" },
      { text: "Studio feed", href: "/feed" },
      { text: "Artist directory", href: "/artists" },
      { text: "Join as an artist", href: "/get-started" },
    ],
  },
  {
    label: "For Patrons",
    links: [
      { text: "Support an artist", href: "/support" },
      { text: "Your collection", href: "/dashboard/collection" },
      { text: "Live campaigns", href: "/live" },
      { text: "Become a patron", href: "/get-started" },
    ],
  },
  {
    label: "For Partners",
    links: [
      { text: "List an opportunity", href: "/partners" },
      { text: "Activations", href: "/partners#activations" },
      { text: "List for free", href: "/partners" },
      { text: "How partnering works", href: "/partners" },
    ],
  },
  {
    label: "More",
    links: [
      { text: "Resources", href: "/resources" },
      { text: "Blog", href: "/blog" },
      { text: "Report a bug", href: "/report-bug" },
      { text: "Contact", href: "mailto:hello@patronage.nz", external: true },
    ],
  },
];

/* v2: column labels in the mono interface voice */
function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Image src="/Favicon_Bleed_512.png" alt="Patronage" width={20} height={20} />
        <span className="text-[15px] font-semibold tracking-[-0.015em] leading-none">
          Patronage
        </span>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--fg-muted)] leading-none">create anyway.</p>
      <p className="mt-3.5 max-w-[220px] text-[13px] leading-[1.65] text-[color:var(--fg-muted)]">
        Connecting artists with opportunity in Aotearoa and beyond.
      </p>
    </div>
  );
}

function FooterAnchor({ link }: { link: FooterLink }) {
  const className =
    "block text-[13px] text-[color:var(--fg-muted)] hover:text-foreground transition-colors";
  if (link.external) {
    return (
      <a href={link.href} className={className}>
        {link.text}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.text}
    </Link>
  );
}

function AccordionColumn({ column }: { column: FooterColumn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4"
      >
        <ColumnLabel>{column.label}</ColumnLabel>
        <ChevronDown
          className={`h-4 w-4 text-[color:var(--fg-subtle)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "240px" : "0" }}
      >
        <nav className="flex flex-col gap-[9px] pb-4">
          {column.links.map((link) => (
            <FooterAnchor key={link.text + link.href} link={link} />
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-feed-bg">
      <div className="max-w-[1600px] mx-auto px-6 pt-[52px]">
        {/* ── Desktop ── */}
        <div className="hidden md:grid grid-cols-[2fr_repeat(4,1fr)] gap-12 mb-11">
          <Brand />
          {COLUMNS.map((col) => (
            <nav key={col.label}>
              <div className="mb-3.5">
                <ColumnLabel>{col.label}</ColumnLabel>
              </div>
              <div className="flex flex-col gap-[9px]">
                {col.links.map((link) => (
                  <FooterAnchor key={link.text + link.href} link={link} />
                ))}
              </div>
            </nav>
          ))}
        </div>

        {/* ── Mobile ── */}
        <div className="md:hidden">
          <div className="mb-6">
            <Brand />
          </div>
          <div className="border-t border-border">
            {COLUMNS.map((col) => (
              <AccordionColumn key={col.label} column={col} />
            ))}
          </div>
        </div>

        {/* ── Bottom bar — mono voice ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border py-5 font-mono text-[11px] text-[color:var(--fg-subtle)]">
          <span>
            © {new Date().getFullYear()} Patronage{" "}
            <span className="text-border">·</span>{" "}
            <span className="italic">create anyway.</span>
          </span>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
