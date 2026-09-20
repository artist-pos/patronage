/**
 * The regional arts organisations Patronage is courting, mapped to the region
 * taxonomy (migration 182).
 *
 * `regionSlug` is the region the organisation is created in, and so the page it
 * anchors. `coversSlugs` is everywhere it actually serves, used only to count
 * the artists it would see; a profile has a single region_id, so a body that
 * spans two regions (Arts Council Nelson: Nelson and Tasman) anchors one page
 * and counts both.
 */
export interface RegionalArtsOrgDef {
  key: string;
  name: string;
  regionSlug: string;
  coversSlugs: string[];
  bio: string;
}

export const REGIONAL_ARTS_ORGS: RegionalArtsOrgDef[] = [
  {
    key: "arts-council-nelson",
    name: "Arts Council Nelson",
    regionSlug: "nelson",
    coversSlugs: ["nelson", "tasman"],
    bio: "Arts Council Nelson (ACN) provides a variety of services through Nelson and Tasman regions. As well as assisting the funding of community arts projects, it also presents a variety of events and initiatives both independently and in partnership with other local groups, businesses and organisations.",
  },
  {
    key: "arts-murihiku",
    name: "Arts Murihiku",
    regionSlug: "southland",
    coversSlugs: ["southland"],
    bio: "Arts Murihiku operates in the Southland, Queenstown/Wakatipu and West Otago region as an independent charitable trust governed by a not-for-profit board. All members are voluntary and unpaid. Project delivery is resourced through funding from Creative NZ and local community grants.",
  },
  {
    key: "creative-bay-of-plenty",
    name: "Creative Bay of Plenty",
    regionSlug: "bay-of-plenty",
    coversSlugs: ["bay-of-plenty"],
    bio: "Creative Bay of Plenty is the arts support agency working across Tauranga and the Western Bay of Plenty. They were established to support the growth of arts and culture to reflect its significant contribution to the vibrancy and wellbeing of communities, as well as the positive impact it has on economic growth and prosperity. The organisation's areas of focus are connecting people, supporting capability building, advocating for the arts, promoting artists and activities, and supporting practitioners to access financial resources to deliver creative projects.",
  },
  {
    key: "creative-northland",
    name: "Creative Northland",
    regionSlug: "northland",
    coversSlugs: ["northland"],
    bio: "Creative Northland is an independent charitable trust governed by a not-for-profit board. It receives annual operating funding from Whangarei District Council, Foundation North funds (to grow the arts regionally) and Creative NZ funds (to support project delivery).",
  },
  {
    key: "creative-taranaki",
    name: "Creative Taranaki",
    regionSlug: "taranaki",
    coversSlugs: ["taranaki"],
    bio: "Creative Taranaki is an independent charitable trust governed by a not-for-profit board and funded by New Plymouth District Council. It was founded in 2021 as Taranaki's regional arts organisation, to connect, support, enable, grow and advocate for the Arts, Creativity & Culture sector in Taranaki. While its main funding comes from NPDC, Creative Taranaki operates throughout the whole of Taranaki, collaborating with South Taranaki District Council's Arts Coordinator in order to reach out to the wider community.",
  },
  {
    key: "creative-waikato",
    name: "Creative Waikato",
    regionSlug: "waikato",
    coversSlugs: ["waikato"],
    bio: "Creative Waikato is the regional arts organisation for the Waikato region, which includes 10 local authorities. They provide creative capability development for artists and arts organisations, advocacy, research and strategic direction and support for sustainable arts, culture, creativity and ngā toi in the region.",
  },
  {
    key: "square-edge",
    name: "Manawatū Square Edge Community Arts",
    regionSlug: "manawatu-whanganui",
    coversSlugs: ["manawatu-whanganui"],
    bio: "Square Edge Community Arts is a not-for-profit community arts organisation with a 40 year history of advocating for and supporting community aspirations through the arts in the wider Manawatū region. Located in Palmerston North City in the historic Square Edge Arts Centre building, Square Edge are acknowledged and supported as a sector-lead organisation by the Palmerston North City Council. They engage with and deliver community arts and cultural initiatives, and offer capability development and opportunities for community, arts practitioners, and arts organisations.",
  },
  {
    key: "nga-toi-hawkes-bay",
    name: "Ngā Toi Hawkes Bay",
    regionSlug: "hawkes-bay",
    coversSlugs: ["hawkes-bay"],
    bio: "Ngā Toi Hawkes Bay Charitable Trust (formerly Creative Hawke's Bay) is governed by a not-for-profit Board. We have been advocating for, supporting, and enabling the Hawke's Bay arts, culture, and creative sector for over 20 years. We support sector development, knowledge-building, capability development, and promoting collaborative investment in creativity across the rohe. We have a role in leading the Toi-tū Regional Strategic Framework in collaboration with our four local councils.",
  },
  {
    key: "te-taumata-toi-a-iwi",
    name: "Te Taumata Toi-a-Iwi",
    regionSlug: "auckland",
    coversSlugs: ["auckland"],
    bio: "Te Taumata Toi-a-Iwi is Auckland's arts regional trust. They contribute to the development of the arts and culture eco-system that makes Tāmaki Makaurau a city alive with creativity. They work with the sector to advocate for the value of Ngā Toi arts, culture, creativity. They support sector development, knowledge-building and capability, convene creative networks, and promote collaborative investment in the region. Te Taumata is supporting the establishment of Te Manawa, a Māori artist-led collective to lead transformational change in the creative sector in Tāmaki Makaurau.",
  },
  {
    key: "three-lakes",
    name: "Three Lakes Cultural Trust",
    regionSlug: "otago",
    coversSlugs: ["otago"],
    bio: "The Three Lakes Cultural Trust was established to encourage and support arts and culture in the Queenstown Lakes District. Their vision is to help create a vibrant, diverse and distinct arts and cultural district that enriches the lives of people within the Three Lakes Region, now and through time.",
  },
  {
    key: "toi-o-taraika",
    name: "Toi o Taraika Arts Wellington",
    regionSlug: "wellington",
    coversSlugs: ["wellington"],
    bio: "Toi o Taraika Arts Wellington is an independent charitable trust governed by a not-for-profit board. It is primarily funded by Wellington City Council with additional income from membership fees.",
  },
  {
    key: "toi-otautahi",
    name: "Toi Ōtautahi Christchurch City Council",
    regionSlug: "canterbury",
    coversSlugs: ["canterbury"],
    bio: "Working with partner agencies (CreativeNZ, Manatū Taonga, and Rātā Foundation), mana whenua, and the arts sector, Council leads delivery of the city's arts strategy, Toi Ōtautahi. Through delivery of Toi Ōtautahi they target investment in strategy priority areas including ngā toi Māori, identity, creativity, inclusion and wellbeing, and leadership. They lead and partner to deliver capacity building workshops, mentoring programmes, artist residencies and commission activity.",
  },
  {
    key: "west-coast-society-of-arts",
    name: "West Coast Society of Arts",
    regionSlug: "west-coast",
    coversSlugs: ["west-coast"],
    bio: "The West Coast Society of Arts is an arts society based in Greymouth on the West Coast of New Zealand's South Island. It is a non-profit organisation. Many of the society's members are practicing artists. It provides a venue and gallery space which has a regional reach.",
  },
];
