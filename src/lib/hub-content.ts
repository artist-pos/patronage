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
