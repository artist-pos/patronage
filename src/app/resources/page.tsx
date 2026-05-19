import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources for Artists | Patronage",
  description: "Guides, templates, and advice for New Zealand and Australian artists applying for grants, residencies, and arts funding opportunities.",
  alternates: { canonical: "https://patronage.nz/resources" },
  openGraph: {
    title: "Resources for Artists | Patronage",
    description: "Guides, templates, and advice for NZ and Australian artists applying for grants, residencies, and arts funding.",
    url: "https://patronage.nz/resources",
    type: "website",
  },
};

interface Section {
  title: string;
  content: string[];
}

const SECTIONS: Section[] = [
  {
    title: "How to write a grant application",
    content: [
      "Read the criteria carefully before you write a single word. Funders are clear about what they want — most rejections come from applications that address the wrong questions, not poor writing.",
      "Open with the work itself, not your biography. What is the project? Why does it matter? Why now? Panels read hundreds of applications; they need to understand your project within the first paragraph.",
      "Be specific about outcomes. Vague aspirations ('to develop my practice') score poorly against concrete deliverables ('to produce 12 new paintings for a group exhibition opening in March'). Specificity signals that you've planned the project properly.",
      "Budget honestly. Funders are experienced — they'll notice if your budget is under-cooked or inflated. Include your own time as a line item (many artists forget this). Show that you understand what the work actually costs.",
      "Demonstrate track record without overselling. Link to documentation of past work. A short, relevant exhibition history or project list is more persuasive than a long one padded with minor credits.",
      "If the funder allows, get feedback on a declined application before reapplying. Most NZ and AU arts bodies offer this service, and it's consistently the most useful thing you can do.",
    ],
  },
  {
    title: "Building a project budget",
    content: [
      "Structure your budget in two columns: grant amount requested and total project cost. This shows funders you have other support or are contributing your own resources — it signals commitment.",
      "Key line items to include: artist fees (your own time and any collaborators'), materials, equipment hire, venue/space costs, documentation (photography, video), travel, accommodation, insurance, and contingency (typically 10%).",
      "Pay yourself. Creative NZ and Creative Australia both expect artist fees to be included. The NZ minimum recommended fee for a professional artist is $35–$45/hour. Using the NAVA Pay the Artist guidelines is good practice.",
      "Be clear about currency if your project involves international components. NZ and AU grant budgets should be in local currency; note conversions explicitly.",
      "A simple spreadsheet is fine. You don't need specialist software — funders want clarity, not design.",
    ],
  },
  {
    title: "Writing an artist statement",
    content: [
      "An artist statement for a grant application is not the same as the statement on your website. It should speak to the specific project, not your practice in general.",
      "Avoid jargon. 'Interrogating the liminal space between materiality and affect' is less compelling than describing what you actually make and why. Write as if explaining to an intelligent non-specialist.",
      "Three paragraphs is usually enough: (1) what you make and the ideas behind it, (2) this specific project and why it's a logical next step, (3) what you hope it achieves and for whom.",
      "Have someone outside the arts read it. If they don't understand it, it needs revision.",
    ],
  },
  {
    title: "Understanding selection criteria",
    content: [
      "Most NZ and AU arts grants assess applications on: artistic merit, professional development potential, feasibility (can you actually deliver this?), and impact (who benefits?).",
      "Artistic merit is assessed differently by different panels. What's consistent: clear vision, evidence of skill, and work that takes a position rather than playing it safe.",
      "Feasibility is often the deciding factor for mid-tier grants. Panels have seen too many projects that were well-intentioned but didn't happen. A realistic timeline, confirmed venues or partners, and a track record of completing projects all help.",
      "Impact doesn't have to mean 'community outreach'. For many grants, 'impact' can mean contribution to the field, new international connections, or advancing your practice in a way that benefits the broader arts ecology.",
    ],
  },
  {
    title: "Key funding bodies — New Zealand",
    content: [
      "Creative New Zealand (CNZ) — cnz.govt.nz. Primary public funder. Programs range from small Quick Response grants to multi-year Arts Practice Awards. Separate funding streams for Toi Māori and Pacific arts.",
      "Foundation North — foundationnorth.org.nz. Largest private arts funder in NZ. Covers Auckland and Northland. Arts & Culture grants run $5,000–$100,000+.",
      "Creative Communities Scheme — administered by local councils, funded by CNZ. Small grants for community-focused arts projects. Check with your local council for round dates.",
      "NZ On Air — nzonair.govt.nz. Funds music, digital, and broadcast content by New Zealand creators.",
      "NZ Film Commission — nzfilm.co.nz. Development, production, and post-production funding for New Zealand screen projects.",
      "Lottery Grants Board (Creative & Heritage) — communitymatters.govt.nz. Funds a wide range of creative and heritage projects.",
    ],
  },
  {
    title: "Key funding bodies — Australia",
    content: [
      "Creative Australia — creative.gov.au. Federal arts funder (formerly Australia Council). Grants for artists across all disciplines, plus fellowships and international programs.",
      "Screen Australia — screenaustralia.gov.au. Development, production, and distribution funding for Australian screen content.",
      "State arts bodies: Arts NSW, Creative Victoria, Arts Queensland, Arts SA, DLGSC (WA), Arts NT, Arts Tasmania, ACT Arts Fund. Each runs parallel grant programs with their own timelines.",
      "Australia Business Arts Foundation (AbaF) — abaf.com.au. Arts philanthropy, creative partnerships, and corporate engagement.",
      "Ian Potter Cultural Trust — ianpotter.org.au. International professional development grants for Australian artists.",
      "Sidney Myer Fund — sidneymyer.com.au. Arts and culture grants, with a focus on innovation and risk-taking.",
      "NAVA (National Association for the Visual Arts) — visualarts.net.au. Advocacy, resources, and sector guidance for visual artists, including the NAVA Code of Practice.",
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-12">

      {/* Header */}
      <div className="space-y-2 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Resources for Artists</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Practical guides for applying for grants, residencies, and arts funding in New Zealand and Australia.
        </p>
      </div>

      {/* Quick links */}
      <nav aria-label="Resource sections">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s.title}>
              <a
                href={`#${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="text-xs border border-black px-2.5 py-1 hover:bg-black hover:text-white transition-colors"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      <div className="space-y-16 max-w-3xl">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            id={section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            className="space-y-4 scroll-mt-20"
          >
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            <ul className="space-y-3">
              {section.content.map((para, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-3">
                  <span className="text-foreground font-medium shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{para}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="border-t border-border pt-10 space-y-3 max-w-xl">
        <p className="text-sm text-muted-foreground">
          Browse active opportunities for NZ and Australian artists.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/opportunities/grants/new-zealand"
            className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            NZ Grants
          </Link>
          <Link
            href="/opportunities/grants/australia"
            className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            AU Grants
          </Link>
          <Link
            href="/opportunities/residencies/new-zealand"
            className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            NZ Residencies
          </Link>
          <Link
            href="/opportunities/residencies/australia"
            className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            AU Residencies
          </Link>
          <Link
            href="/opportunities"
            className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            All opportunities →
          </Link>
        </div>
      </div>
    </div>
  );
}
