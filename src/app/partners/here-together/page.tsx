import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { HereTogetherContact } from "@/components/here-together/HereTogetherContact";
import { PhotoCarousel } from "@/components/here-together/PhotoCarousel";
import { VisitMap } from "@/components/here-together/VisitMap";
import { WeekPlanner } from "@/components/here-together/WeekPlanner";
import { PartnerSideNav } from "@/components/partners/PartnerSideNav";
import "./here-together.css";

// Concept page for Here Together. Unlisted: not linked from the partners
// index, not indexed, and nothing here is a confirmed programme. No prices or
// amounts, no named membership tiers, nothing about the terms of any space.
export const metadata: Metadata = {
  title: "Here Together: a creative commons, gallery and maker space",
  description: "Make, show, connect. A proposed creative commons, gallery and maker space in a vacant building, with Patronage.",
  robots: { index: false, follow: false },
  openGraph: { title: "Here Together", description: "A creative commons, gallery and maker space. Make, show, connect.", images: [] },
};

const NAV = [
  { id: "concept", label: "Concept" },
  { id: "what", label: "Overview" },
  { id: "how", label: "How it works" },
  { id: "being", label: "Being here" },
  { id: "week", label: "A typical week" },
  { id: "programme", label: "Exhibitions" },
  { id: "patronage", label: "Part of Patronage" },
  { id: "space", label: "The space" },
  { id: "model", label: "A model that can travel" },
  { id: "principles", label: "Principles" },
  { id: "stages", label: "Where it's at" },
  { id: "partners", label: "Partners and funders" },
  { id: "contact", label: "Get in touch" },
];

const FACTS = ["Open to anyone", "A new exhibition about every three weeks", "Regular non-exhibition programming", "Modular and reconfigurable"];

const PILLARS = [
  ["Make", "Studio space for artists and makers, open to visitors while they work."],
  ["Show", "A rolling exhibition programme, with a new show approximately every three weeks, run by artists and artist-run collectives."],
  ["Connect", "Talks, crits, workshops, family sessions and larger public events between exhibitions."],
];

// Who it is for, in order: the public first, partners last.
const AUDIENCE = [
  ["The public", "Anyone can come in, spend time, see art and take part."],
  ["The creative community", "Artists and makers use the space to work, exhibit and connect."],
  ["The wider community", "Families, students, neighbours and other visitors join in the programme."],
  ["Partners", "Organisations support the programme, use the space and meet its community."],
];

// Ways to use the space. Some free, some booked or by subscription. No prices.
const USES = [
  ["Drop in", "Free. See the exhibitions, spend time in the shared areas and come to public activities."],
  ["Become a regular", "A subscription for people who come often: access to shared working areas and gatherings for regulars."],
  ["A studio of your own", "A dedicated place to make, with storage and access to shared facilities."],
  ["Book the space", "Hire part of the room for a workshop, meeting, presentation or independent event."],
  ["Make something happen", "Partner with Here Together on a programme, a gathering or an exhibition."],
  ["Buy the work", "Art and prints are for sale through Patronage. A commission on each sale goes back into the programme."],
];

// The other four strands of the programme.
const STRANDS = [
  ["Families", "A regular programme for children and families, with chances to make, experiment and spend time together. Affordable prints and artworks make it possible to take a little piece of the space home."],
  ["Weeknights", "Practical evenings with business partners on contracts, tax and money for people who make things, and pitch nights that bring investors into a room full of art."],
  ["Headline events", "About once a quarter, a sponsor-backed event big enough to make the news, from an oyster-eating competition to a 24-hour drawing marathon. The aim is to be known for being good."],
  ["Artist-run collectives", "Collectives borrow the room for little or no hire, run their own show and host their own crit."],
];

// What Patronage brings to the building.
const PATRONAGE = [
  ["An artist network", "Artists across Aotearoa who already use Patronage to find work and opportunities."],
  ["Open calls", "The application and selection tools that run every exhibition and opportunity."],
  ["Profiles and records", "Every artist's work, exhibitions and history, kept in one place."],
  ["Sales", "The means to sell work and prints, during a show and after it."],
  ["Organisations", "Relationships with organisations and potential commissioners."],
  ["Beyond the building", "Opportunities documented and shared online, so the programme reaches further than the room."],
];

const MODEL = [
  ["It wakes a building up", "An empty floor becomes a reason to come into the building, the street and the neighbourhood."],
  ["It leaves no trace", "Nothing is fixed to the building. The fit-out is designed to be removed, and the space handed back as found."],
  ["It is a method, not only a room", "The show cycle, the host handbook, the fit-out and the reporting are written down, so the model can move to the next vacant building."],
  ["It is a live test", "A year of real programming shows what brings people in and brings them back. That is useful to anyone planning a venue, a museum or a precinct."],
];

const PRINCIPLES = [
  ["Brave space", "Room to try things, show unfinished work and disagree well."],
  ["Openness with care", "Open to anyone, with clear rules, hosts and proper safeguards."],
  ["Collective stewardship", "The people who use the room help shape it and look after it."],
  ["Transparency as trust", "Selections, decisions and results are shared openly."],
  ["Future nostalgia", "Children make things here, and families take home work they will grow up with."],
  ["The Patron Table", "A long communal table at the centre of the room. It belongs to the public."],
];

const STEPS = [
  ["Students design it", "Bachelor of Architecture students enter designs for the fit-out. Entrants keep credit for their work."],
  ["A design to build", "The intention is to build the chosen design: low-cost, sustainable and modular, and removable when the space is handed back."],
  ["Students stay involved", "From the build, to testing it with the artists, to a showcase in the finished room."],
];

const STAGES = [
  ["Confirm the space", "Agree the building, the term and how it can be used."],
  ["Secure founding support", "Partners and funders for the fit-out and the first year."],
  ["Design and build", "The fit-out, designed and built with Bachelor of Architecture students."],
  ["Open and programme", "Studios, exhibitions and the public programme begin."],
  ["Review", "A review at six to twelve months, shared with partners."],
];
const NOW = 0;

// Each partner type, expandable: a one-line summary always visible, then what
// involvement looks like, what Here Together needs, and what they get back.
type Partner = { name: string; lede: string; involve: string; need: string; get: string };
const PARTNERS: Partner[] = [
  {
    name: "Founding stewards",
    lede: "Early backers who help set it up.",
    involve: "Commit before opening and help shape how the space works in its first year.",
    need: "Support for the fit-out and the first year of operation, with advice and introductions.",
    get: "A founding role in a new kind of public space, recognition as a founding steward, and a seat at the review.",
  },
  {
    name: "Funders",
    lede: "Support a defined part of the public programme.",
    involve: "Back a strand of the programme, such as family sessions or open public access to making and art.",
    need: "Support for programme delivery, artist fees and materials.",
    get: "A quarterly impact update with artistic, social and civic measures, and a programme you can point to.",
  },
  {
    name: "Programme partners",
    lede: "A recurring series, workshop or gathering.",
    involve: "Bring your organisation into the room through something useful, such as weeknight evenings on contracts, tax or money for people who make things.",
    need: "Expertise, presenters and support for a series.",
    get: "Regular contact with artists, designers, makers and small businesses, through something they actually value.",
  },
  {
    name: "Event sponsors",
    lede: "A single night: an opening, a closing or a headline event.",
    involve: "Back one event and be part of it on the night.",
    need: "Support for the event itself, or food and drink for it.",
    get: "Credit on the event and its coverage, and a night people talk about.",
  },
  {
    name: "Materials and industry partners",
    lede: "Products and expertise for the fit-out and the programme.",
    involve: "Supply or demonstrate materials and products used in the fit-out and in the programme.",
    need: "Timber, hardware, lighting, furniture, making supplies, coffee and food.",
    get: "Your products in daily use in a public space, demonstration evenings, and contact with the people who specify, design and build.",
  },
  {
    name: "Councils and placemakers",
    lede: "Connect the space to the street and the city.",
    involve: "Link the space into wayfinding, family trips and weekend programming.",
    need: "Help with signage, promotion, permits and programme support.",
    get: "A busy public room where there was an empty building, more people in the area, and outcomes you can report.",
  },
  {
    name: "Space owners",
    lede: "A vacant building or floor, for a defined term.",
    involve: "Provide the space, and help with access and building services.",
    need: "The space itself, with clear terms of use.",
    get: "A building in productive use, people in the neighbourhood, and a fit-out designed for removal so the space is handed back as found.",
  },
  {
    name: "Educators",
    lede: "Students designing, building and exhibiting.",
    involve: "Bring students into the design, the build and the programme.",
    need: "Students, staff time and a link to coursework.",
    get: "Real briefs, and a public venue to build in and exhibit in.",
  },
  {
    name: "Individual patrons",
    lede: "Time, knowledge, networks or a single show.",
    involve: "Volunteer, mentor, make introductions, or support one exhibition.",
    need: "People who will give a little time or support to the artists and the programme.",
    get: "A close connection to the artists and the programme, and recognition on the shows you support.",
  },
];

const PROPOSE: { name: string; lede: string; body: string }[] = [
  { name: "A pilot first", lede: "12 months, with a review.", body: "Here Together is planned as a 12-month pilot, with a review at six to twelve months that is shared with partners." },
  { name: "A quarterly impact update", lede: "Four kinds of measure.", body: "Artistic, social, civic and commercial measures, such as new faces, repeat visits, exhibitions, applications, sales for artists and press." },
  { name: "Run with care", lede: "Hosting, supervision and child safety.", body: "Clear hosting arrangements, appropriate supervision and child-safety procedures for all public activities." },
  { name: "Credited, not branded", lede: "Recognition without taking over.", body: "Partners are recognised on programmes and shows without taking over the room." },
];

// The nine partner types in four groups, so the accordion is four rows, not nine.
const byName = (n: string) => PARTNERS.find((p) => p.name === n)!;
const PARTNER_GROUPS: { name: string; members: Partner[] }[] = [
  { name: "Funding and backing", members: ["Founding stewards", "Funders", "Individual patrons"].map(byName) },
  { name: "Programme and events", members: ["Programme partners", "Event sponsors"].map(byName) },
  { name: "Space and place", members: ["Space owners", "Councils and placemakers"].map(byName) },
  { name: "Making and learning", members: ["Materials and industry partners", "Educators"].map(byName) },
];

function Plus() {
  return <span className="ht-acc-sign" aria-hidden />;
}

const SHOWS = [
  ["Open call", "Each exhibition is advertised to Patronage's network of artists across Aotearoa."],
  ["Selection", "Artists and artist-run collectives apply. Shows are chosen openly, against a published brief."],
  ["About three weeks", "Install, opening night, a public crit and a closing night, with the work for sale."],
  ["On the record", "Every show is documented on Patronage, adding to the artists' records and the programme's."],
];

function Parts({ items, cols }: { items: string[][]; cols?: 2 | 4 }) {
  return (
    <div className={`ht-parts${cols ? ` ht-parts--${cols}` : ""}`}>
      {items.map(([h, p]) => (
        <div key={h} className="ht-part">
          <h3>{h}</h3>
          <p>{p}</p>
        </div>
      ))}
    </div>
  );
}

export default function HereTogetherPage() {
  return (
    <div className="ht">
      <PartnerSideNav sections={NAV} />

      {/* ══ HERO ══ */}
      <section id="concept" className="ht-wrap ht-hero">
        <div className="ht-masthead ht-arrive">
          <h1 className="ht-wordmark">Here Together</h1>
          <p className="ht-with">
            <span>with</span> Patronage
          </p>
        </div>
        <div className="ht-split ht-split--media-left" style={{ marginTop: "clamp(2rem, 6vh, 3.5rem)", alignItems: "stretch" }}>
          <div className="flex flex-col justify-between gap-10">
            <div className="ht-arrive ht-arrive-2">
              <p className="ht-lede">A creative commons, gallery and maker space.</p>
              <p className="ht-lede" style={{ marginTop: "0.6rem", color: "var(--ink-soft)" }}>
                Make<span className="ht-red">.</span> Show<span className="ht-red">.</span> Connect<span className="ht-red">.</span>
              </p>
            </div>
            <ul className="ht-facts ht-arrive ht-arrive-3">
              {FACTS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="ht-shot ht-hero-shot ht-arrive ht-arrive-4">
            <Image
              src="/here-together/trust-2.jpg"
              alt="A large open room with timber floors, exposed brick and steel columns"
              fill
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ══ OVERVIEW ══ */}
      <section id="what" className="ht-section ht-wrap">
        <div className="ht-col">
          <p className="ht-intro">
            Here Together is a proposed public creative space for a vacant building. It brings studios, a gallery and a
            regular public programme into one room, and it is open to all. The concept is in development and will take
            its final shape with its partners.
          </p>
          <p className="ht-help" style={{ marginTop: "1.25rem" }}>
            Bring a coffee, a laptop, a book or the kids, and stay as long as you like. Nobody needs a reason to be
            there, and nobody should feel out of place.
          </p>
        </div>
        <Parts items={PILLARS} />
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">How it works</h2>
          <p className="ht-help">
            The room is designed around four steps, from walking past to coming back. It is deliberately built to bring
            together people who might not otherwise share a room.
          </p>
        </div>
        <VisitMap />
        <h3 className="ht-h3">Who it&rsquo;s for</h3>
        <Parts items={AUDIENCE} cols={4} />
      </section>

      {/* ══ BEING HERE ══ */}
      <section id="being" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Being here</h2>
          <p className="ht-help">
            People come here to work, exhibit, socialise, learn, sell, host and collaborate. Here Together is open to
            everyone. Some ways of using the space are free, and others are by booking or subscription, so the building
            stays public while the people who use it most help sustain it.
          </p>
        </div>
        <Parts items={USES} />
      </section>

      {/* ══ A TYPICAL WEEK ══ */}
      <section id="week" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">A typical week</h2>
          <p className="ht-help">
            Studios during the day, and something on most evenings and weekends. Choose a day. This is an example
            programme, not a confirmed one.
          </p>
        </div>
        <WeekPlanner />
      </section>

      {/* ══ EXHIBITIONS ══ */}
      <section id="programme" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Exhibitions</h2>
          <p className="ht-help">A rolling exhibition programme, with a new show approximately every three weeks.</p>
        </div>
        <ol className="ht-flow">
          {SHOWS.map(([h, p]) => (
            <li key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>

        <h3 className="ht-h3">Around the exhibitions</h3>
        <Parts items={STRANDS} cols={2} />
      </section>

      {/* ══ PART OF PATRONAGE ══ */}
      <section id="patronage" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Part of Patronage</h2>
          <p className="ht-help">
            Patronage connects artists across Aotearoa with commissions, grants and opportunities. Here Together is a
            physical extension of that work: a place where the connections Patronage makes online can happen in person.
            It is not a separate gallery that borrows a database. It starts with infrastructure that already exists.
          </p>
        </div>
        <Parts items={PATRONAGE} />
      </section>

      {/* ══ THE SPACE, AND THE DESIGN COMPETITION ══ */}
      <section id="space" className="ht-section ht-wrap">
        <div className="ht-split">
          <div>
            <h2 className="ht-h2">The space</h2>
            <p className="ht-help">
              The fit-out is being developed in partnership with Bachelor of Architecture students, through a design
              competition run by the Houlton Trust. The brief is a modular, reconfigurable layout that can work as
              studios, a gallery or an event space.
            </p>
            <p className="ht-small">The kind of space we are working toward. Competition details are the Trust&rsquo;s to confirm.</p>
          </div>
          <PhotoCarousel />
        </div>
        <Parts items={STEPS} />
      </section>

      {/* ══ A MODEL THAT CAN TRAVEL ══ */}
      <section id="model" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">A model that can travel</h2>
          <p className="ht-help">
            Here Together is planned as a 12-month pilot in a vacant building. It tests a combination of cultural
            programming, creative workspace, public access and earned income that could be adapted to other vacant
            spaces.
          </p>
        </div>
        <Parts items={MODEL} cols={2} />
      </section>

      {/* ══ PRINCIPLES ══ */}
      <section id="principles" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Principles</h2>
          <p className="ht-help">How the room is run, and how decisions about it are made.</p>
        </div>
        <ul className="ht-list ht-list--2">
          {PRINCIPLES.map(([h, p]) => (
            <li key={h}>
              <strong>{h}.</strong> {p}
            </li>
          ))}
        </ul>
      </section>

      {/* ══ WHERE IT'S AT ══ */}
      <section id="stages" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Where it&rsquo;s at</h2>
          <p className="ht-help">Five stages from here to an open room.</p>
        </div>
        <ol className="ht-stages">
          {STAGES.map(([h, p], n) => (
            <li key={h} data-now={n === NOW ? "true" : undefined}>
              <span className="ht-stage-mark">
                <i aria-hidden />
                {n === NOW ? "Now" : `Stage ${n + 1}`}
              </span>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══ PARTNERS AND FUNDERS ══ */}
      <section id="partners" className="ht-section ht-wrap">
        <div className="ht-col">
          <h2 className="ht-h2">Partners and funders</h2>
          <p className="ht-help">
            Partners do more than appear on a sign. They get to do something meaningful in the space, and meet people
            they might otherwise struggle to reach. They can contribute time, knowledge, materials, networks, space or
            money.
          </p>
        </div>
        <h3 className="ht-h3">Ways to be involved</h3>
        <div className="ht-acc">
          {PARTNER_GROUPS.map((g) => (
            <details key={g.name}>
              <summary>
                <span>{g.name}</span>
                <span className="ht-acc-lede">{g.members.map((m) => m.name).join(", ")}</span>
                <Plus />
              </summary>
              <div className="ht-acc-group">
                {g.members.map((p) => (
                  <div key={p.name} className="ht-acc-member">
                    <h4>{p.name}</h4>
                    <dl className="ht-acc-body">
                      <div>
                        <dt>What it looks like</dt>
                        <dd>{p.involve}</dd>
                      </div>
                      <div>
                        <dt>What we need</dt>
                        <dd>{p.need}</dd>
                      </div>
                      <div>
                        <dt>What you get</dt>
                        <dd>{p.get}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>

        <h3 className="ht-h3">What we propose</h3>
        <ul className="ht-list ht-list--2">
          {PROPOSE.map((p) => (
            <li key={p.name}>
              <strong>{p.name}.</strong> {p.body}
            </li>
          ))}
        </ul>
      </section>

      {/* ══ GET IN TOUCH ══ */}
      <section id="contact" className="ht-section ht-wrap">
        <div className="ht-split" style={{ alignItems: "start" }}>
          <div>
            <h2 className="ht-h2">Get in touch</h2>
            <p className="ht-help">
              For a conversation or a walk-through, tell us who you are and what you might bring. Blake replies within two
              business days.
            </p>
            <p className="ht-small">Led by Blake Aitken, architectural designer, artist and founder of Patronage.</p>
            <Link href="/blakeaitken" className="ht-work">
              Blake&rsquo;s profile <span className="ht-arrow" aria-hidden />
            </Link>
          </div>
          <div className="ht-form">
            <HereTogetherContact />
          </div>
        </div>
      </section>
    </div>
  );
}
