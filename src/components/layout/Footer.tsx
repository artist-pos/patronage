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
      { text: "List an opportunity", href: "/partner/opportunities/new" },
      { text: "Activations", href: "/partners#activations" },
      { text: "List for free", href: "/partner/list-free" },
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

function Brand() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Image src="/Favicon_Bleed_512.png" alt="Patronage" width={28} height={28} />
        <span className="text-xl font-semibold tracking-tight text-stone-900 leading-none">
          Patronage
        </span>
      </div>
      <p className="mt-1.5 ml-9 text-sm text-stone-500 leading-none">create anyway.</p>
      <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-stone-500">
        Connecting artists with opportunity in Aotearoa and beyond.
      </p>
    </div>
  );
}

function FooterAnchor({ link }: { link: FooterLink }) {
  const className =
    "block py-1 text-sm text-stone-600 hover:text-stone-900 transition-colors";
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
    <div className="border-b border-stone-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-xs font-medium uppercase tracking-widest text-stone-400"
      >
        {column.label}
        <ChevronDown
          className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "240px" : "0" }}
      >
        <nav className="pb-3">
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
    <footer className="border-t border-stone-100 bg-stone-50">
      <div className="max-w-[1600px] mx-auto px-6 pt-12 pb-8">
        {/* ── Desktop ── */}
        <div className="hidden md:grid grid-cols-[1.5fr_repeat(4,1fr)] gap-10">
          <Brand />
          {COLUMNS.map((col) => (
            <nav key={col.label}>
              <div className="mb-4 text-xs font-medium uppercase tracking-widest text-stone-400">
                {col.label}
              </div>
              {col.links.map((link) => (
                <FooterAnchor key={link.text + link.href} link={link} />
              ))}
            </nav>
          ))}
        </div>

        {/* ── Mobile ── */}
        <div className="md:hidden">
          <div className="mb-6">
            <Brand />
          </div>
          <div className="border-t border-stone-100">
            {COLUMNS.map((col) => (
              <AccordionColumn key={col.label} column={col} />
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-stone-100 pt-4 text-xs text-stone-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} Patronage</span>
            <span className="text-stone-300">create anyway.</span>
          </div>
          <div className="flex items-center gap-x-4">
            <Link href="/terms" className="hover:text-stone-600 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-stone-600 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
