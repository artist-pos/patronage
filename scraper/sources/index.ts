import type { Source } from "../types.js";

export const sources: Source[] = [

  // ── Tier 1: Aggregators (highest yield per scrape) ───────────────────────

  { name: "NAVA Opportunities", url: "https://visualarts.net.au/opportunities/", country: "AUS", isListPage: true },
  { name: "Artshub AU Opportunities", url: "https://www.artshub.com.au/jobs-and-opportunities/", country: "AUS", isListPage: true },
  { name: "ResArtis Open Calls", url: "https://resartis.org/open-calls/", country: "Global", isListPage: true },
  { name: "CaFE / Call for Entry", url: "https://www.callforentry.org/", country: "Global", isListPage: true },
  { name: "A-N Opportunities", url: "https://www.a-n.co.uk/opportunities/", country: "Global", isListPage: true },
  { name: "Artquest Opportunities", url: "https://www.artquest.org.uk/opportunities/", country: "Global", isListPage: true },
  { name: "Trans Artists", url: "https://www.transartists.org/en/air", country: "Global", isListPage: true },
  { name: "Open Calls", url: "https://opencalls.net/", country: "Global", isListPage: true },
  { name: "Art Deadline", url: "https://www.artdeadline.com/", country: "Global", isListPage: true },
  { name: "Aesthetica Open Calls", url: "https://aestheticamagazine.com/open-calls/", country: "Global", isListPage: true },
  { name: "Alliance of Artists Communities", url: "https://www.artistcommunities.org/opportunities", country: "Global", isListPage: true },
  { name: "Submittable Open Calls", url: "https://www.submittable.com/t/open-calls", country: "Global", isListPage: true },

  // ── Tier 1: RSS Feeds ────────────────────────────────────────────────────

  { name: "Creative NZ RSS", url: "https://www.creativenz.govt.nz/news-and-posts?format=rss", country: "NZ", isRss: true },
  { name: "Artshub AU RSS", url: "https://www.artshub.com.au/feed/", country: "AUS", isRss: true },
  { name: "NAVA News RSS", url: "https://visualarts.net.au/feed/", country: "AUS", isRss: true },
  { name: "Artlink RSS", url: "https://www.artlink.com.au/feed/", country: "AUS", isRss: true },
  { name: "Pantograph Punch RSS", url: "https://pantograph-punch.com/feed", country: "NZ", isRss: true },
  { name: "Art Guide Australia RSS", url: "https://www.artguide.com.au/feed/", country: "AUS", isRss: true },
  { name: "Running Dog RSS", url: "https://runningdog.nz/feed/", country: "NZ", isRss: true },
  { name: "Aesthetica Magazine RSS", url: "https://aestheticamagazine.com/feed/", country: "Global", isRss: true },
  { name: "A-N RSS", url: "https://www.a-n.co.uk/feed/", country: "Global", isRss: true },
  { name: "Artquest RSS", url: "https://www.artquest.org.uk/feed/", country: "Global", isRss: true },

  // ── Tier 2: NZ Government & Funded Bodies ───────────────────────────────

  { name: "Creative NZ All Opportunities", url: "https://www.creativenz.govt.nz/funding-and-support/all-opportunities", country: "NZ", isListPage: true, needsBrowser: true },
  { name: "NZ On Air", url: "https://www.nzonair.govt.nz/music/funding/", country: "NZ", isListPage: true },
  { name: "NZ Film Commission", url: "https://www.nzfilm.co.nz/funding", country: "NZ", isListPage: true },
  { name: "Foundation North", url: "https://foundationnorth.org.nz/grants/", country: "NZ", isListPage: true },
  { name: "Pub Charity", url: "https://pubcharitynz.org.nz/apply/", country: "NZ" },
  { name: "Lion Foundation", url: "https://www.lionfoundation.org.nz/apply-for-a-grant/", country: "NZ" },
  { name: "Trust Waikato", url: "https://www.trustwaikato.co.nz/apply/", country: "NZ" },
  { name: "Community Trust Southland", url: "https://www.ctsl.nz/apply-for-funding/", country: "NZ" },
  { name: "Otago Community Trust", url: "https://www.oct.org.nz/apply-for-a-grant/", country: "NZ" },
  { name: "Community Trust Mid & South Canterbury", url: "https://www.communitytrust.org.nz/grants/", country: "NZ" },
  { name: "Nelson Marlborough Trust", url: "https://nmct.co.nz/apply/", country: "NZ" },
  { name: "Toi Māori Aotearoa", url: "https://www.toimaori.nz/apply/", country: "NZ" },
  { name: "Manatū Taonga", url: "https://www.mch.govt.nz/funding-and-programmes", country: "NZ", isListPage: true },
  { name: "Te Māngai Pāho", url: "https://www.tmp.govt.nz/apply-for-funding/", country: "NZ" },
  { name: "Arts Regional Trust", url: "https://www.artsregionaltrust.govt.nz/", country: "NZ" },
  { name: "Auckland Council Arts", url: "https://www.aucklandcouncil.govt.nz/arts-culture-heritage/arts-culture-funding/Pages/default.aspx", country: "NZ", isListPage: true },
  { name: "Wellington City Council Arts", url: "https://wellington.govt.nz/arts-parks-and-events/arts/funding-for-the-arts", country: "NZ", isListPage: true },
  { name: "Christchurch City Arts", url: "https://ccc.govt.nz/culture-and-community/arts/funding", country: "NZ", isListPage: true },
  { name: "Dunedin City Arts", url: "https://www.dunedin.govt.nz/arts-culture-and-heritage/arts-funding", country: "NZ", isListPage: true },
  { name: "Hamilton City Arts", url: "https://www.hamilton.govt.nz/our-community/community-funding", country: "NZ", isListPage: true },
  { name: "Ngā Taonga Sound & Vision", url: "https://www.ngataonga.org.nz/", country: "NZ" },
  { name: "Wallace Arts Trust", url: "https://www.wallaceartstrust.org.nz/", country: "NZ" },

  // ── Tier 2: Australian Federal & State ───────────────────────────────────

  { name: "Australia Council Grants", url: "https://www.australiacouncil.gov.au/funding/", country: "AUS", isListPage: true },
  { name: "Screen Australia", url: "https://www.screenaustralia.gov.au/funding-and-support", country: "AUS", isListPage: true },
  { name: "AIATSIS Grants", url: "https://aiatsis.gov.au/grants-and-fellowships", country: "AUS", isListPage: true },
  { name: "National Gallery of Australia", url: "https://nga.gov.au/prizes-and-commissions/", country: "AUS", isListPage: true },
  { name: "Create NSW", url: "https://www.create.nsw.gov.au/funding-and-support/", country: "AUS", isListPage: true },
  { name: "Creative Victoria", url: "https://creative.vic.gov.au/grants-and-support", country: "AUS", isListPage: true },
  { name: "Arts Queensland", url: "https://www.arts.qld.gov.au/funding", country: "AUS", isListPage: true },
  { name: "DLGSC Western Australia", url: "https://www.dlgsc.wa.gov.au/arts/funding-and-support", country: "AUS", isListPage: true },
  { name: "Arts South Australia", url: "https://www.arts.sa.gov.au/funding/", country: "AUS", isListPage: true },
  { name: "ArtsACT", url: "https://www.arts.act.gov.au/funding", country: "AUS", isListPage: true },
  { name: "Arts Tasmania", url: "https://www.arts.tas.gov.au/grants_and_funding", country: "AUS", isListPage: true },
  { name: "Northern Territory Arts", url: "https://arts.nt.gov.au/grants", country: "AUS", isListPage: true },
  { name: "City of Sydney Arts", url: "https://www.cityofsydney.nsw.gov.au/grants/arts", country: "AUS", isListPage: true },
  { name: "City of Melbourne Arts", url: "https://www.melbourne.vic.gov.au/arts-and-culture/arts-grants", country: "AUS", isListPage: true },
  { name: "Brisbane City Arts", url: "https://www.brisbane.qld.gov.au/community-and-safety/grants-awards", country: "AUS", isListPage: true },
  { name: "ANAT Opportunities", url: "https://anat.org.au/opportunities/", country: "AUS", isListPage: true },
  { name: "Artlink Australia", url: "https://www.artlink.com.au/", country: "AUS" },

  // ── Tier 3: Australian Prizes ─────────────────────────────────────────────

  { name: "Archibald / Wynne / Sulman Prizes", url: "https://www.artgallery.nsw.gov.au/prizes/", country: "AUS", isListPage: true },
  { name: "Dobell Prize for Drawing", url: "https://www.artgallery.nsw.gov.au/prizes/dobell/", country: "AUS" },
  { name: "Darling Portrait Prize", url: "https://www.artgallery.nsw.gov.au/prizes/darling/", country: "AUS" },
  { name: "Brett Whiteley Travelling Scholarship", url: "https://www.artgallery.nsw.gov.au/prizes/brett-whiteley-travelling-art-scholarship/", country: "AUS" },
  { name: "Doug Moran National Portrait Prize", url: "https://www.moranprizes.com.au/", country: "AUS" },
  { name: "Waterhouse Natural Science Art Prize", url: "https://www.samuseum.sa.gov.au/waterhouse", country: "AUS" },
  { name: "Blake Prize", url: "https://www.blakeprize.com.au/", country: "AUS" },
  { name: "Glover Prize Tasmania", url: "https://www.gloverprizetasmania.com.au/", country: "AUS" },
  { name: "National Portrait Gallery Canberra Prizes", url: "https://portrait.gov.au/prizes", country: "AUS", isListPage: true },
  { name: "Portia Geach Memorial Award", url: "https://sydneywomenart.com.au/portia-geach/", country: "AUS" },
  { name: "Fisher's Ghost Award", url: "https://www.campbelltown.nsw.gov.au/fishers-ghost-art-prize", country: "AUS" },
  { name: "Mosman Art Prize", url: "https://mosmanartprize.com.au/", country: "AUS" },
  { name: "Paddington Art Prize", url: "https://paddingtonartprize.com.au/", country: "AUS" },
  { name: "Kedumba Drawing Award", url: "https://www.kedumba.com.au/", country: "AUS" },
  { name: "Lethbridge Art Prize", url: "https://www.lethbridgegallery.com/", country: "AUS" },
  { name: "Ravenswood Women's Art Prize", url: "https://www.ravenswood.nsw.edu.au/artprize", country: "AUS" },
  { name: "Churchie Emerging Art Prize", url: "https://churchie.com.au/artprize", country: "AUS" },
  { name: "John Fries Award", url: "https://www.johnfriesaward.com.au/", country: "AUS" },
  { name: "Bay of Fires Art Prize", url: "https://bayoffiresartprize.com.au/", country: "AUS" },
  { name: "Burnie Print Prize", url: "https://www.burnieprintprize.com.au/", country: "AUS" },
  { name: "Stanthorpe Art Prize", url: "https://stanthorpeartfestival.com.au/", country: "AUS" },
  { name: "Hatched PICA", url: "https://www.pica.org.au/hatched/", country: "AUS" },
  { name: "National Works on Paper Mornington", url: "https://www.mornpen.vic.gov.au/About-Us/What-we-do/Mornington-Peninsula-Regional-Gallery/Exhibitions-Events/National-Works-on-Paper", country: "AUS" },
  { name: "Castlemaine Art Museum Prize", url: "https://castlemainegallery.com.au/", country: "AUS" },
  { name: "Redlands Art Prize", url: "https://www.redlands.nsw.gov.au/", country: "AUS" },

  // ── Tier 3: NZ Prizes ────────────────────────────────────────────────────

  { name: "Wallace Art Awards", url: "https://www.wallaceartstrust.org.nz/art-awards/", country: "NZ" },
  { name: "Parkin Drawing Prize", url: "https://parkindrawingprize.co.nz/", country: "NZ" },
  { name: "Waikato Museum Art Award", url: "https://www.waikatomuseum.co.nz/", country: "NZ" },
  { name: "Adam Portraiture Award", url: "https://www.citygallery.org.nz/", country: "NZ" },
  { name: "NZ Sculpture OnShore", url: "https://www.sculptureonshore.com/", country: "NZ" },
  { name: "Ashburton Art Gallery Prize", url: "https://www.ashburtongallery.org.nz/", country: "NZ" },

  // ── Tier 4: International Prizes ─────────────────────────────────────────

  { name: "BP Portrait Award UK", url: "https://www.npg.org.uk/whatson/bp-portrait-award/", country: "UK" },
  { name: "Taylor Wessing Portrait Prize", url: "https://www.npg.org.uk/whatson/taylor-wessing-photographic-portrait-prize/", country: "UK" },
  { name: "Arte Laguna Prize Venice", url: "https://www.artelagunaprize.com/", country: "Global" },
  { name: "Celeste Prize", url: "https://www.celesteprize.com/", country: "Global" },
  { name: "Aesthetica Art Prize", url: "https://aestheticamagazine.com/art-prize/", country: "Global" },
  { name: "Jackson's Art Prize UK", url: "https://www.jacksonsart.com/competitions/", country: "UK" },
  { name: "National Open Art UK", url: "https://www.nationalopenart.org.uk/", country: "UK" },
  { name: "LensCulture Awards", url: "https://www.lensculture.com/competitions", country: "Global" },
  { name: "Head On Photo Festival Sydney", url: "https://headon.com.au/open-calls/", country: "AUS" },
  { name: "Ballarat International Foto Biennale", url: "https://www.biff.com.au/", country: "AUS" },
  { name: "Sovereign Asian Art Prize", url: "https://sovereign-asian-art-prize.com/", country: "Global" },
  { name: "Premio Lissone", url: "https://www.premiolissone.it/", country: "Global" },
  { name: "London International Creative Competition", url: "https://liccompetition.com/", country: "Global" },

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
  { name: "Millay Colony for the Arts", url: "https://www.millaycolony.org/apply", country: "Global" },
  { name: "MASS MoCA Residency", url: "https://massmoca.org/event/residency/", country: "Global" },

  // ── Tier 4: Fellowship & Exchange Programs ───────────────────────────────

  { name: "Fulbright New Zealand", url: "https://www.fulbright.org.nz/", country: "NZ", isListPage: true },
  { name: "Fulbright Australia", url: "https://www.fulbright.org.au/", country: "AUS", isListPage: true },
  { name: "Asian Cultural Council", url: "https://www.asianculturalcouncil.org/apply", country: "Global", isListPage: true },
  { name: "Japan Foundation Australia", url: "https://jpf.org.au/arts/", country: "Global", isListPage: true },
  { name: "Goethe-Institut Australia", url: "https://www.goethe.de/ins/au/en/kul/bku.html", country: "Global", isListPage: true },
  { name: "British Council Australia", url: "https://www.britishcouncil.org.au/programmes", country: "Global", isListPage: true },
  { name: "Korea Foundation", url: "https://www.kf.or.kr/eng/", country: "Global" },
  { name: "Alliance Française Australia", url: "https://www.afaustralia.org.au/", country: "Global" },

  // ── Tier 4: Gallery Open Calls ───────────────────────────────────────────

  { name: "Artspace NZ", url: "https://www.artspace.org.nz/", country: "NZ" },
  { name: "Te Tuhi Auckland", url: "https://tetuhi.art/", country: "NZ" },
  { name: "Physics Room Christchurch", url: "https://physicsroom.org.nz/", country: "NZ" },
  { name: "Enjoy Public Art Gallery Wellington", url: "https://enjoy.org.nz/", country: "NZ" },
  { name: "Blue Oyster Art Project Space", url: "https://www.blueoyster.org.nz/", country: "NZ" },
  { name: "Objectspace NZ", url: "https://objectspace.org.nz/", country: "NZ" },
  { name: "Govett-Brewster Art Gallery", url: "https://www.govettbrewster.com/", country: "NZ" },
  { name: "CIRCUIT Artist Film NZ", url: "https://www.circuit.org.nz/", country: "NZ" },
  { name: "PICA Perth", url: "https://www.pica.org.au/", country: "AUS" },
  { name: "Gertrude Contemporary Melbourne", url: "https://www.gertrude.org.au/", country: "AUS" },
  { name: "Artspace Sydney", url: "https://www.artspace.org.au/", country: "AUS" },
  { name: "Carriageworks Sydney", url: "https://carriageworks.com.au/", country: "AUS" },
  { name: "4A Centre for Contemporary Asian Art", url: "https://www.4a.com.au/", country: "AUS" },
  { name: "Firstdraft Sydney", url: "https://firstdraft.org.au/", country: "AUS" },
  { name: "Bus Projects Melbourne", url: "https://www.busprojects.org.au/", country: "AUS" },
  { name: "Jerwood Arts UK", url: "https://jerwoodarts.org/opportunities/", country: "UK", isListPage: true },
  { name: "Gasworks London", url: "https://www.gasworks.org.uk/opportunities/", country: "UK", isListPage: true },
  { name: "Tate Opportunities", url: "https://www.tate.org.uk/about-us/opportunities", country: "UK", isListPage: true },
  { name: "Arts Council England", url: "https://www.artscouncil.org.uk/our-open-funds", country: "UK", isListPage: true },
  { name: "Creative Scotland", url: "https://www.creativescotland.com/funding/", country: "UK", isListPage: true },

];
