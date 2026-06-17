import type { Source } from "../types.js";

export const sources: Source[] = [

  // ── Tier 1: International Aggregators (highest yield per scrape) ──────────
  // One good aggregator > 50 individual gallery pages.

  // WP REST replaces the old list-page crawl — full catalogue, no Playwright, no pagination
  { name: "NAVA Opportunities", url: "https://visualarts.net.au", country: "AUS", feedUrl: "/wp-json/wp/v2/posts", isAggregator: true },
  { name: "Contemporary Performance", url: "https://contemporaryperformance.com", country: "Global", disciplines: ["performance"], feedUrl: "/wp-json/wp/v2/posts", isAggregator: true },
  { name: "A-N Opportunities", url: "https://www.a-n.co.uk", country: "Global", feedUrl: "/wp-json/wp/v2/posts", isAggregator: true },
  { name: "Artquest Opportunities", url: "https://www.artquest.org.uk", country: "Global", feedUrl: "/wp-json/wp/v2/posts", isAggregator: true },
  { name: "Aesthetica Magazine", url: "https://aestheticamagazine.com", country: "Global", feedUrl: "/wp-json/wp/v2/posts", isAggregator: true },
  { name: "Art Guide Australia", url: "https://www.artguide.com.au", country: "AUS", feedUrl: "/wp-json/wp/v2/posts" },
  { name: "ANAT Opportunities", url: "https://anat.org.au", country: "AUS", feedUrl: "/wp-json/wp/v2/posts" },
  { name: "ResArtis Open Calls", url: "https://resartis.org/open-calls/", country: "Global", isListPage: true, followLinks: true, isAggregator: true },
  { name: "CaFE / Call for Entry", url: "https://www.callforentry.org/", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "Trans Artists", url: "https://www.transartists.org/en/air", country: "Global", isListPage: true, needsBrowser: true, followLinks: true, isAggregator: true },
  { name: "Open Calls", url: "https://opencalls.net/", country: "Global", isListPage: true, needsBrowser: true, followLinks: true, isAggregator: true },
  { name: "Art Deadline List", url: "https://artdeadline.com/", country: "Global", isListPage: true, needsBrowser: true, followLinks: true, maxLinks: 1000, pages: 10, paginationUrl: "https://artdeadline.com/page/{page}/", isAggregator: true },
  { name: "Apply For Art", url: "https://www.applyforart.com/", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "Open Call for Artists", url: "https://opencallforartists.com", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "ArtInfoLand Australia", url: "https://artinfoland.com/location/australia/", country: "AUS", isListPage: true, followLinks: true, maxLinks: 150, pages: 13, paginationUrl: "https://artinfoland.com/location/australia/page/{page}/", isAggregator: true, linkPattern: /\/opportunities\// },
  { name: "ArtInfoLand New Zealand", url: "https://artinfoland.com/location/new-zealand/", country: "NZ", isListPage: true, followLinks: true, maxLinks: 30, pages: 3, paginationUrl: "https://artinfoland.com/location/new-zealand/page/{page}/", isAggregator: true, linkPattern: /\/opportunities\// },
  { name: "ArtConnect Open Calls", url: "https://www.artconnect.com/open-calls", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "ArtRabbit Opportunities", url: "https://www.artrabbit.com/artist-opportunities", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "On the Move", url: "https://www.on-the-move.org/", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "ArtJobs", url: "https://www.artjobs.com/", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "e-flux Announcements", url: "https://www.e-flux.com/announcements/", country: "Global", isListPage: true, followLinks: true, maxLinks: 10, isAggregator: true },
  { name: "CuratorSpace", url: "https://curatorspace.com/opportunities", country: "Global", isListPage: true, followLinks: true, maxLinks: 15, isAggregator: true },
  { name: "Alliance of Artists Communities", url: "https://www.artistcommunities.org/", country: "Global", isListPage: true, followLinks: true },

  // ── Tier 1: RSS Feeds ────────────────────────────────────────────────────

  // Creative NZ + Artshub kept as RSS — CNZ doesn't expose WP REST, Artshub blocks it
  { name: "Creative NZ RSS", url: "https://www.creativenz.govt.nz/news-and-posts?format=rss", country: "NZ", isRss: true },
  { name: "Artshub AU RSS", url: "https://www.artshub.com.au/feed/", country: "AUS", isRss: true },

  // ── Tier 2: NZ Government & Funded Bodies ───────────────────────────────

  { name: "Creative NZ All Opportunities", url: "https://www.creativenz.govt.nz/funding-and-support/all-opportunities", country: "NZ", isListPage: true, needsBrowser: true, followLinks: true, maxLinks: 25, sitemapUrl: "https://www.creativenz.govt.nz/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/funding-and-support\/(early-career-artists|artists-and-practitioners|arts-organisations-and-groups|all-opportunities)\//, detailBudget: 60 },
  { name: "NZ On Air", url: "https://www.nzonair.govt.nz/funding/", country: "NZ", disciplines: ["music", "film"], isListPage: true, followLinks: true, sitemapUrl: "https://www.nzonair.govt.nz/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/funding\//, detailBudget: 40 },
  { name: "NZ Film Commission", url: "https://www.nzfilm.co.nz/funding-support-nz-filmmakers/funding", country: "NZ", disciplines: ["film"], isListPage: true, followLinks: true, sitemapUrl: "https://www.nzfilm.co.nz/sitemaps-1-section-pages-1-sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/funding-support-nz-filmmakers\//, detailBudget: 30 },
  { name: "Foundation North", url: "https://foundationnorth.org.nz/", country: "NZ", isListPage: true, needsBrowser: true, followLinks: true },
  { name: "Trust Waikato", url: "https://www.trustwaikato.co.nz/apply/", country: "NZ" },
  { name: "Lion Foundation", url: "https://www.lionfoundation.org.nz/", country: "NZ" },
  { name: "Otago Community Trust", url: "https://www.oct.org.nz/", country: "NZ" },
  { name: "Manatū Taonga", url: "https://www.mch.govt.nz/", country: "NZ", isListPage: true },
  { name: "Te Māngai Pāho", url: "https://www.tmp.govt.nz/", country: "NZ" },
  { name: "Ngā Taonga Sound & Vision", url: "https://www.ngataonga.org.nz/", country: "NZ" },
  { name: "Wallace Arts Trust", url: "https://www.wallaceartstrust.org.nz/", country: "NZ" },
  { name: "Arts Foundation Te Tūāpapa Toi", url: "https://www.artsfoundation.org.nz/awards/", country: "NZ", isListPage: true, followLinks: true },
  { name: "Tautai Pacific Arts Trust", url: "https://tautai.org/", country: "NZ", isListPage: true, followLinks: true },
  { name: "Auckland Council Arts", url: "https://www.aucklandcouncil.govt.nz/arts-culture-heritage", country: "NZ", isListPage: true },
  { name: "Wellington City Council Arts", url: "https://wellington.govt.nz/arts-parks-and-events/arts", country: "NZ", isListPage: true },

  // ── Tier 2: Australian Federal & State ───────────────────────────────────
  // Note: Australia Council rebranded → Creative Australia (creative.gov.au).
  // All old australiacouncil.gov.au subpaths are dead.

  { name: "Creative Australia", url: "https://creative.gov.au/investments-opportunities/", country: "AUS", isListPage: true, needsBrowser: true, followLinks: true, maxLinks: 20, sitemapUrl: "https://creative.gov.au/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/(investments-opportunities|first-nations-arts)\//, detailBudget: 60 },
  { name: "Screen Australia", url: "https://www.screenaustralia.gov.au/funding-and-support", country: "AUS", disciplines: ["film"], isListPage: true, followLinks: true, sitemapUrl: "https://www.screenaustralia.gov.au/fund-sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/fund\//, detailBudget: 40 },
  { name: "National Gallery of Australia", url: "https://nga.gov.au/prizes-and-commissions/", country: "AUS", isListPage: true, followLinks: true },
  { name: "Create NSW", url: "https://www.nsw.gov.au/arts-and-culture/engage-nsw-arts-and-culture/get-funding-and-support", country: "AUS", isListPage: true, needsBrowser: true, followLinks: true, linkPattern: /\/(arts-and-culture|grants-and-funding)\// },
  { name: "Creative Victoria", url: "https://creative.vic.gov.au/", country: "AUS", isListPage: true, needsBrowser: true, followLinks: true },
  { name: "Arts Queensland", url: "https://www.arts.qld.gov.au/", country: "AUS", isListPage: true, needsBrowser: true, followLinks: true, sitemapUrl: "https://www.arts.qld.gov.au/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/(funding-opportunities|regional-arts|projects-and-partnerships)\//, detailBudget: 40 },
  { name: "DLGSC Western Australia", url: "https://www.dlgsc.wa.gov.au/arts", country: "AUS", isListPage: true, followLinks: true },
  { name: "Arts South Australia", url: "https://www.arts.sa.gov.au/funding/", country: "AUS", isListPage: true, followLinks: true },
  { name: "ArtsACT", url: "https://www.arts.act.gov.au/funding", country: "AUS", isListPage: true, followLinks: true },
  { name: "Arts Tasmania", url: "https://www.arts.tas.gov.au/grants_and_funding", country: "AUS", isListPage: true, followLinks: true, sitemapUrl: "https://www.arts.tas.gov.au/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/grants/, detailBudget: 30 },
  { name: "Northern Territory Arts", url: "https://arts.nt.gov.au/grants", country: "AUS", isListPage: true, followLinks: true },
  { name: "Art Support Australia", url: "https://www.artsupport.com.au/opportunities", country: "AUS", isListPage: true, followLinks: true, sitemapUrl: "https://www.artsupport.com.au/sitemap.xml", sitemapLastmodOnly: true, linkPattern: /\/opportunities\//, detailBudget: 30 },
  { name: "Artlink Australia", url: "https://www.artlink.com.au/", country: "AUS" },

  // ── Tier 3: Australian Prizes ─────────────────────────────────────────────

  { name: "Archibald / Wynne / Sulman Prizes", url: "https://www.artgallery.nsw.gov.au/prizes/", country: "AUS", isListPage: true },
  { name: "Dobell Prize for Drawing", url: "https://www.artgallery.nsw.gov.au/prizes/dobell/", country: "AUS" },
  { name: "Doug Moran National Portrait Prize", url: "https://www.moranprizes.com.au/", country: "AUS" },
  { name: "Waterhouse Natural Science Art Prize", url: "https://www.samuseum.sa.gov.au/waterhouse", country: "AUS" },
  { name: "Blake Prize", url: "https://www.blakeprize.com.au/", country: "AUS" },
  { name: "Paddington Art Prize", url: "https://paddingtonartprize.com.au/", country: "AUS" },
  { name: "Kedumba Drawing Award", url: "https://www.kedumba.com.au/", country: "AUS" },
  { name: "Lethbridge Art Prize", url: "https://www.lethbridgegallery.com/", country: "AUS" },
  { name: "John Fries Award", url: "https://www.johnfriesaward.com.au/", country: "AUS" },
  { name: "Bay of Fires Art Prize", url: "https://bayoffiresartprize.com.au/", country: "AUS" },
  { name: "Hatched PICA", url: "https://www.pica.org.au/hatched/", country: "AUS" },
  { name: "Castlemaine Art Museum Prize", url: "https://castlemainegallery.com.au/", country: "AUS" },

  // ── Tier 3: NZ Prizes ────────────────────────────────────────────────────

  { name: "Wallace Art Awards", url: "https://www.wallaceartstrust.org.nz/", country: "NZ" },
  { name: "Waikato Museum Art Award", url: "https://www.waikatomuseum.co.nz/", country: "NZ" },
  { name: "Adam Portraiture Award", url: "https://www.citygallery.org.nz/", country: "NZ" },

  // ── Tier 4: International Prizes ─────────────────────────────────────────

  { name: "Arte Laguna Prize Venice", url: "https://www.artelagunaprize.com/", country: "Global" },
  { name: "Celeste Prize", url: "https://www.celesteprize.com/", country: "Global" },
  { name: "Aesthetica Art Prize", url: "https://aestheticamagazine.com/art-prize/", country: "Global" },
  { name: "LensCulture Awards", url: "https://www.lensculture.com/competitions", country: "Global" },
  { name: "Ballarat International Foto Biennale", url: "https://www.biff.com.au/", country: "AUS" },
  { name: "Prix Ars Electronica", url: "https://www.ars.electronica.art/prix/", country: "Global" },

  // ── Tier 4: International Residency Programs ─────────────────────────────

  { name: "Cité Internationale des Arts Paris", url: "https://www.citedesartsparis.net/en/", country: "Global" },
  { name: "Künstlerhaus Bethanien Berlin", url: "https://www.bethanien.de/en/", country: "Global" },
  { name: "ISCP New York", url: "https://www.iscp-nyc.org/", country: "Global" },
  { name: "NARS Foundation NY", url: "https://www.narsfoundation.org/", country: "Global" },
  { name: "Headlands Center for the Arts", url: "https://headlands.org/program/", country: "Global" },
  { name: "Vermont Studio Center", url: "https://vermontstudiocenter.org/fellowships/", country: "Global" },
  { name: "MacDowell Fellowship", url: "https://www.macdowell.org/apply", country: "Global" },
  { name: "Yaddo", url: "https://www.yaddo.org/apply/", country: "Global" },
  { name: "Ucross Foundation", url: "https://ucross.org/residency-program/", country: "Global" },

  // ── Tier 4: Fellowship & Exchange Programs ───────────────────────────────

  { name: "Fulbright New Zealand", url: "https://www.fulbright.org.nz/awards/", country: "NZ", isListPage: true, followLinks: true },
  { name: "British Council Australia", url: "https://www.britishcouncil.org.au/programmes", country: "Global", isListPage: true, followLinks: true },
  { name: "Korea Foundation", url: "https://www.kf.or.kr/eng/", country: "Global" },
  { name: "Asia NZ Foundation", url: "https://www.asianz.org.nz/funding/", country: "NZ", isListPage: true, followLinks: true },
  { name: "Foundation for Contemporary Arts", url: "https://www.foundationforcontemporaryarts.org/", country: "Global", isListPage: true, followLinks: true },

  // ── Tier 4: Gallery Open Calls ───────────────────────────────────────────

  { name: "Artspace NZ", url: "https://www.artspace.org.nz/", country: "NZ" },
  { name: "Te Tuhi Auckland", url: "https://tetuhi.art/", country: "NZ" },
  { name: "Physics Room Christchurch", url: "https://physicsroom.org.nz/", country: "NZ" },
  { name: "Enjoy Public Art Gallery Wellington", url: "https://enjoy.org.nz/", country: "NZ" },
  { name: "Blue Oyster Art Project Space", url: "https://www.blueoyster.org.nz/", country: "NZ" },
  { name: "Objectspace NZ", url: "https://objectspace.org.nz/", country: "NZ" },
  { name: "Govett-Brewster Art Gallery", url: "https://www.govettbrewster.com/", country: "NZ" },
  { name: "CIRCUIT Artist Film NZ", url: "https://www.circuit.org.nz/", country: "NZ" },
  { name: "Dowse Art Museum", url: "https://www.dowse.org.nz/", country: "NZ" },
  { name: "Chartwell Trust", url: "https://www.chartwell.org.nz/", country: "NZ" },
  { name: "PICA Perth", url: "https://www.pica.org.au/", country: "AUS" },
  { name: "Gertrude Contemporary Melbourne", url: "https://www.gertrude.org.au/", country: "AUS" },
  { name: "Artspace Sydney", url: "https://www.artspace.org.au/", country: "AUS" },
  { name: "Carriageworks Sydney", url: "https://carriageworks.com.au/", country: "AUS" },
  { name: "4A Centre for Contemporary Asian Art", url: "https://www.4a.com.au/", country: "AUS" },
  { name: "Firstdraft Sydney", url: "https://firstdraft.org.au/", country: "AUS" },
  { name: "Bus Projects Melbourne", url: "https://www.busprojects.org.au/", country: "AUS" },
  { name: "Gasworks London", url: "https://www.gasworks.org.uk/opportunities/", country: "UK", isListPage: true, followLinks: true },
  { name: "Arts Council England", url: "https://www.artscouncil.org.uk/our-open-funds", country: "UK", isListPage: true, followLinks: true },
  { name: "Creative Scotland", url: "https://www.creativescotland.com/funding/", country: "UK", isListPage: true, followLinks: true },
  { name: "Jerwood Arts UK", url: "https://jerwoodarts.org/", country: "UK", isListPage: true, followLinks: true },

  // ── NZ Regional Arts Development Organisations ───────────────────────────

  { name: "Creative Bay of Plenty", url: "https://www.creativebop.org.nz/opportunities/", country: "NZ", isListPage: true, followLinks: true },
  { name: "Creative Northland", url: "https://creativenorthland.com/funding/", country: "NZ", isListPage: true, followLinks: true },
  { name: "Creative Waikato", url: "https://creativewaikato.co.nz/", country: "NZ", isListPage: true, followLinks: true },

  // ── NZ Specialist ─────────────────────────────────────────────────────────

  { name: "Prazzle Arts", url: "https://www.prazzlearts.com/opportunities", country: "NZ", isListPage: true, needsBrowser: true },
  { name: "Sargeson Fellowship", url: "https://www.creativenz.govt.nz/funding-and-support/find-funding/sargeson-residency", country: "NZ" },
  { name: "Australian Art Network", url: "https://www.artnetwork.com.au/opportunities", country: "AUS", isListPage: true, followLinks: true },

  // ── Music ─────────────────────────────────────────────────────────────────

  { name: "SOUNZ Opportunities", url: "https://www.sounz.org.nz/opportunities", country: "NZ", disciplines: ["music"], isListPage: true, followLinks: true },
  { name: "Creative NZ Music Grants", url: "https://www.creativenz.govt.nz/funding-and-support/find-funding?category=music", country: "NZ", disciplines: ["music"], isListPage: true, needsBrowser: true, followLinks: true },
  { name: "APRA AMCOS", url: "https://www.apraamcos.com.au/", country: "Global", disciplines: ["music"], isListPage: true, followLinks: true },
  { name: "Sound and Music", url: "https://soundandmusic.org/opportunities/", country: "UK", disciplines: ["music", "sound_art"], isListPage: true, followLinks: true },
  { name: "Musical Chairs", url: "https://www.musicalchairs.info/", country: "Global", disciplines: ["music"], isListPage: true, followLinks: true, maxLinks: 15 },
  { name: "New Music USA", url: "https://www.newmusicusa.org/grants/", country: "Global", disciplines: ["music"], isListPage: true, followLinks: true },
  { name: "Chamber Music NZ", url: "https://www.chambermusic.co.nz/opportunities/", country: "NZ", disciplines: ["music"] },

  // ── Writing & Poetry ─────────────────────────────────────────────────────

  { name: "Creative NZ Literature Grants", url: "https://www.creativenz.govt.nz/funding-and-support/find-funding?category=literature", country: "NZ", disciplines: ["writing", "poetry"], isListPage: true, needsBrowser: true, followLinks: true },
  { name: "NZ Book Council", url: "https://www.bookcouncil.org.nz/", country: "NZ", disciplines: ["writing"], isListPage: true, followLinks: true },
  { name: "Landfall Journal Submissions", url: "https://www.otago.ac.nz/press/journals/landfall/submissions/", country: "NZ", disciplines: ["writing", "poetry"] },
  { name: "Starling Magazine", url: "https://starlingmag.com/submissions/", country: "NZ", disciplines: ["poetry", "writing"] },
  { name: "Verb Wellington Writers Festival", url: "https://verbwellington.nz/", country: "NZ", disciplines: ["writing"] },
  { name: "Queensland Writers Centre", url: "https://qwc.com.au/opportunities/", country: "AUS", disciplines: ["writing"], isListPage: true, followLinks: true },
  { name: "Varuna Writers House", url: "https://varuna.com.au/residencies/", country: "AUS", disciplines: ["writing"], isListPage: true, followLinks: true },
  { name: "Emerging Writers Festival", url: "https://emergingwritersfestival.org.au/opportunities/", country: "AUS", disciplines: ["writing"], isListPage: true, followLinks: true },
  { name: "Poets & Writers", url: "https://www.pw.org/grants", country: "Global", disciplines: ["writing", "poetry"], isListPage: true, followLinks: true, maxLinks: 15, linkPattern: /\/grants/ },

  // ── Dance & Performance ───────────────────────────────────────────────────

  { name: "Tempo Dance Festival", url: "https://www.tempodancefestival.co.nz/", country: "NZ", disciplines: ["dance", "performance"] },
  { name: "Atamira Dance Company", url: "https://www.atamira.co.nz/", country: "NZ", disciplines: ["dance"] },
  { name: "Chunky Move", url: "https://www.chunkymove.com/opportunities/", country: "AUS", disciplines: ["dance", "performance"] },

  // ── Film ──────────────────────────────────────────────────────────────────

  { name: "NZ International Film Festival", url: "https://www.nziff.co.nz/", country: "NZ", disciplines: ["film"] },
  { name: "Film Victoria", url: "https://www.film.vic.gov.au/funding/", country: "AUS", disciplines: ["film"], isListPage: true, followLinks: true, linkPattern: /\/funding\// },
  { name: "Screenwest", url: "https://www.screenwest.com.au/funding/", country: "AUS", disciplines: ["film"], isListPage: true, followLinks: true, linkPattern: /\/funding/ },
  { name: "South Australian Film Corporation", url: "https://www.safilm.com.au/funding/", country: "AUS", disciplines: ["film"], isListPage: true, followLinks: true, linkPattern: /\/funding\// },

];
