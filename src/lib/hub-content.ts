export interface HubContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: string;
}

export const HUB_CONTENT: Record<string, HubContent> = {
  "grants/new-zealand": {
    title: "Art Grants — New Zealand",
    metaTitle: "Art Grants New Zealand 2026 | Patronage",
    metaDescription: "Browse active art grants for New Zealand artists. Funding from Creative NZ, Foundation North, regional arts councils, and independent funders. Updated weekly.",
    intro: "New Zealand has one of the most active arts funding ecosystems in the Pacific, with grants available across visual art, music, writing, film, and performing arts.",
    body: `New Zealand arts grants are administered by a mix of national bodies, regional trusts, and private foundations. Creative New Zealand (CNZ) is the primary public funder, offering grants ranging from small project support (under $5,000) to multi-year Arts Practice Awards of up to $120,000. CNZ funding is open to all New Zealand citizens and permanent residents, with dedicated rounds for Māori and Pacific arts.

Regional arts councils — including Auckland's Creative Communities Scheme, Wellington's Wellington Community Trust, and similar bodies in Canterbury, Waikato, and Otago — fund work that benefits local communities. These tend to be smaller grants ($500–$20,000) with faster turnaround and less competition than national rounds.

Foundation North (formerly ASB Community Trust) is the largest private arts funder in the country, prioritising projects in Auckland and Northland. Their Arts and Culture grants run $5,000–$100,000+. Other major private funders include the Lion Foundation, Pub Charity, and the Lottery Grants Board.

Most NZ grants follow a similar annual rhythm: applications open in late summer (February–April) and winter (July–September), with outcomes announced 6–12 weeks later. Some funders like Creative NZ operate rolling applications for smaller amounts.

When applying, funders consistently look for clear project outcomes, demonstrated artistic practice, realistic budgets, and evidence of community or sector benefit. A strong track record of completing previous funded work significantly improves your chances.`,
  },

  "grants/australia": {
    title: "Art Grants — Australia",
    metaTitle: "Art Grants Australia 2026 | Patronage",
    metaDescription: "Browse active art grants for Australian artists. Funding from Creative Australia, state arts bodies, and private foundations. Updated weekly.",
    intro: "Australia funds artists through a layered system of federal, state, and private grants — one of the most comprehensive arts funding structures in the Asia-Pacific.",
    body: `Creative Australia (formerly Australia Council for the Arts) is the primary federal funder, offering grants from small project support through to multi-year fellowships. Key programs include the Artists grants (up to $80,000), First Nations arts grants, and the prestigious Australia Council Fellowships. Federal funding is open to Australian citizens and permanent residents working professionally in the arts.

Each state and territory operates its own arts funding body: Arts NSW, Creative Victoria, Arts Queensland, Arts SA, DLGSC (WA), Arts NT, Arts Tasmania, and the ACT Arts Fund. These run parallel grant programs with their own eligibility requirements and timelines, often prioritising work that engages local communities or takes place in their state.

Screen Australia funds film, television, and interactive projects. The Australia Business Arts Foundation (AbaF) and Philanthropy Australia support arts philanthropy and corporate partnerships. Major private foundations including Sidney Myer Fund, Ian Potter Cultural Trust, and the Helen Macpherson Smith Trust also offer competitive grants.

Federal Australia Council rounds typically open twice a year (March and August). State body timelines vary — check each body's website as some run quarterly while others have rolling applications for smaller amounts.

Australian grant applications are assessed on artistic merit, professional development potential, and impact. Demonstrating financial sustainability, a track record of delivery, and clear community engagement are strong differentiators.`,
  },

  "residencies/new-zealand": {
    title: "Artist Residencies — New Zealand",
    metaTitle: "Artist Residencies New Zealand 2026 | Patronage",
    metaDescription: "Browse artist residencies in New Zealand. Studio time, accommodation, and stipends for NZ and international artists. Updated weekly.",
    intro: "New Zealand's artist residencies range from community studios in regional towns to internationally recognised programmes at major cultural institutions.",
    body: `New Zealand offers a diverse range of artist residencies, from short intensive retreats to year-long studio programmes. Most provide some combination of dedicated studio space, accommodation, and a stipend — though the balance varies widely.

Creative New Zealand funds several flagship residencies: the New Zealand Residencies programme places artists at international venues including the Tylee Cottage in Whanganui (a CNZ-managed space welcoming national and international artists), and exchange residencies with partner organisations in France, Germany, and the US. The Michael King Writers' Centre in Devonport offers New Zealand writers month-long residencies in a historic villa.

Regional programmes are often the most accessible entry points. The Dunedin Public Art Gallery, Te Manawa (Palmerston North), and Govett-Brewster Art Gallery (New Plymouth) run annual artist-in-residence programmes. The Suter Art Gallery in Nelson offers a community studio residency with a small stipend.

Residency durations in New Zealand typically run 2–12 weeks. Stipends range from nothing (studio-only) to $2,000–$5,000 per month for fully supported programmes. Accommodation is provided for most major residencies.

International artists are eligible for many NZ residencies, though some programmes prioritise domestic applicants. Applications are typically assessed on artistic merit, the strength of the proposed project, and evidence of professional practice. Many residencies value how the applicant intends to engage with the local community or landscape.`,
  },

  "residencies/australia": {
    title: "Artist Residencies — Australia",
    metaTitle: "Artist Residencies Australia 2026 | Patronage",
    metaDescription: "Browse artist residencies in Australia. Studios, accommodation, and stipends across all states. Updated weekly.",
    intro: "Australia's artist residency landscape spans remote bush studios, inner-city gallery programmes, and prestigious international exchange residencies.",
    body: `Australia's residency programmes range from informal studio-sharing arrangements to fully-funded international residencies administered by state and federal bodies. The scale and support on offer reflects Australia's strong commitment to sustaining professional artistic practice.

Creative Australia manages several significant residency programmes, including the Paris Studio (a long-running exchange with the Cité internationale des arts), and residencies at locations across Australia through its Artists in Residence program. State arts bodies complement this with their own residency funding: Creative Victoria's Studio Residency program, Arts NSW's Artspace residency, and Arts Queensland's regional programs.

NAVA (National Association for the Visual Arts) maintains a directory of residency opportunities and advocates for artist pay equity in residency programmes — many now include stipends of $500–$2,000 per week for professional artists.

Private and institution-run residencies include those at major galleries (AGNSW, NGV, MUMA), universities with dedicated artist-in-residence programmes, and organisations like Bundanon (NSW), Creswick Foundation (VIC), and the Australian Tapestry Workshop (VIC). Regional residencies in WA, SA, and Tasmania often offer significant space and time at lower competition levels than metropolitan programmes.

Residency durations in Australia typically run 2 weeks to 3 months. When applying, clarity about your project, how the residency environment serves your practice, and plans for community or public engagement are consistently valued by selection panels.`,
  },

  "open-calls/new-zealand": {
    title: "Open Calls for Artists — New Zealand",
    metaTitle: "Open Calls for Artists New Zealand 2026 | Patronage",
    metaDescription: "Browse open calls, submission opportunities, and calls for entry for New Zealand artists. Exhibitions, prizes, publications, and public art commissions. Updated weekly.",
    intro: "New Zealand's open call landscape is active year-round, with galleries, festivals, public art bodies, and independent publishers regularly inviting submissions from local and international artists.",
    body: `Open calls in New Zealand cover a wide range of opportunities: exhibition proposals, works for sale at art fairs, entries for prizes and awards, submissions for artist-run publications, and expressions of interest for public art commissions.

Gallery-run open submissions are common at artist-run spaces and smaller commercial galleries throughout the country. The International Art Show at Objectspace, the Parkin Drawing Prize, and the Wallace Arts Trust awards are among the most visible annual open calls for visual artists. Craft and object-based artists have strong representation through galleries like Objectspace, Masterworks Gallery, and the New Zealand Society of Artists in Glass.

Public art commissions are increasingly listed as open calls, particularly through Auckland Council's Public Art team, Wellington's Public Art Programme, and Ōtautahi Creative Spaces in Christchurch. These tend to be site-specific and come with detailed community engagement requirements.

Artist-run spaces — particularly in Auckland, Wellington, and Dunedin — run their own open calls for residency exhibitions and group shows. Following these spaces on social media remains the most reliable way to catch short-notice opportunities.

Most open calls are free or low-cost to enter. Where entry fees apply, they typically support prizes or event costs. When submitting, read selection criteria carefully: many NZ open calls value work that responds to local contexts, landscapes, or communities.`,
  },

  "open-calls/australia": {
    title: "Open Calls for Artists — Australia",
    metaTitle: "Open Calls for Artists Australia 2026 | Patronage",
    metaDescription: "Browse open calls, submission opportunities, and calls for entry for Australian artists. Exhibitions, prizes, publications, and public art. Updated weekly.",
    intro: "Australia has one of the most active open call ecosystems in the Asia-Pacific, driven by a dense network of artist-run spaces, state galleries, festivals, and public art programmes.",
    body: `Open calls in Australia span submission-based exhibitions, artist residencies by expression of interest, public art commissions, festival participation, and entries for some of the country's most significant prizes.

The Archibald, Wynne, and Sulman Prizes (Art Gallery of NSW) and the National Works on Paper Prize are among the highest-profile annual open calls for Australian artists. The Ramsay Art Prize (Art Gallery of SA) and the National Aboriginal and Torres Strait Islander Art Awards offer significant prize money and exhibition opportunities. Most major state galleries run at least one open submission competition per year.

Artist-run initiatives (ARIs) across Australia run frequent open calls for group shows, residencies, and collaborative projects. Outre Gallery, Bus Projects, Alaska Projects, and TCB Art Inc are examples of organisations that regularly invite submissions through open calls. Following ARI networks in each state is essential for staying across emerging opportunities.

Public art commissions are increasingly offered as open expressions of interest, with budgets ranging from $10,000 for small installations to $1,000,000+ for major infrastructure projects. The National Capital Authority, state transport departments, and local councils all list these opportunities, though they are often time-sensitive and require demonstrated experience with large-scale fabrication.

When entering Australian open calls, applications typically require a project proposal or artist statement, a portfolio of relevant work (usually 5–10 images), a CV, and sometimes a budget. Many open calls are now submitted through online portals such as Submittable, Slideroom, or Arts Hub.`,
  },
};

export const HUB_TYPE_MAP: Record<string, string> = {
  grants: "Grant",
  residencies: "Residency",
  "open-calls": "Open Call",
  prizes: "Prize",
  jobs: "Job / Employment",
};

export const HUB_COUNTRY_MAP: Record<string, string> = {
  "new-zealand": "NZ",
  australia: "AUS",
};

export const HUB_COUNTRY_LABEL: Record<string, string> = {
  "new-zealand": "New Zealand",
  australia: "Australia",
};

export const HUB_TYPE_LABEL: Record<string, string> = {
  grants: "Grants",
  residencies: "Residencies",
  "open-calls": "Open Calls",
  prizes: "Prizes",
  jobs: "Jobs",
};
