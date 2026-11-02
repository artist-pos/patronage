# Shadow accounts for unlinked organisers — for review

Drafted 2026-11-01 from a read-only pass over the live database. Follows on from [organiser-link-matches.md](organiser-link-matches.md). **Nothing has been created.** None of these organisers has an existing profile under a similar name, so there's no risk of duplicates.

## How to create them

Use the existing admin flow: **Admin → Claim tokens → Generate token**, choosing to create a new shadow profile (`GenerateTokenModal` → `createShadowProfile` in `src/app/admin/claim-tokens/actions.ts`). It creates the placeholder login and the profile together, so the account can be followed (see [social-phase-1.md](social-phase-1.md), feature 1). Enter the name, the type "Partner", and the category and region below. The form doesn't take a website, so add that afterwards in the admin profile editor.

This also creates a claim token for each organisation. No email goes out until you send it, so you can hold the claim outreach until the follow feature is live and the page has something to show.

## Recommended — NZ organisations (12)

| Name to enter | Category | Region | Website | Listings to link |
|---|---|---|---|---|
| New Zealand Film Commission | Council / Government | — (national) | nzfilm.co.nz | 5 |
| NZ On Air | Council / Government | — (national) | nzonair.govt.nz | 3 (incl. joint with Te Māngai Pāho) |
| Te Māngai Pāho | Council / Government | — (national) | tmp.govt.nz | 1 |
| UXBRIDGE Arts and Culture | — | Auckland | uxbridge.org.nz | 2 |
| Te Tuhi | Gallery / Museum | Auckland | tetuhi.art | 1 |
| Auckland Live | — | Auckland | aucklandlive.co.nz | 1 |
| Basement Theatre | — | Auckland | basementtheatre.co.nz | 1 |
| Footnote New Zealand Dance | — | Wellington | footnote.org.nz | 1 |
| Te Pūkenga Whakaata – New Zealand Portrait Gallery | Gallery / Museum | Wellington | nzportraitgallery.org.nz | 1 |
| Massey University – Toi Rauwhārangi College of Creative Arts | School / Art school | Wellington | creative.massey.ac.nz | 1 |
| New Zealand Glassworks Te Whare Tūhua o Te Ao | Residency / Studio programme | Manawatū-Whanganui | nzglassworks.com | 1 |
| Dunedin Fringe Arts Trust | — | Otago | dunedinfringe.nz | 1 |

That adds 19 linked listings, which with the 6 confident matches takes coverage from 15 to about 40 of 105.

Notes:
- **Joint listings** link to the lead organisation, the one whose site the listing points at. The NZ On Air / Te Māngai Pāho "Waiata Takitahi" round links to NZ On Air.
- **Te Māngai Pāho** could be a single-listing account, but it funds Māori music and broadcasting every round, so it's worth having.
- **Dunedin Fringe**: its current listing is a job (Organisational Lead), but the festival puts out an artist call every year.
- The NZ Film Commission listings use two spellings ("(NZFC)" and "(Te Tumu Whakaata Taonga)"). The SQL below sets them all to one.
- Websites for Basement Theatre, Footnote and Dunedin Fringe weren't on the listings (they link to Airtable or nothing), so I've given the organisations' usual domains. Check them before you save.

## Category gap

Five of the twelve don't fit any current organisation category. Theatres, venues, dance companies and festivals (Auckland Live, Basement Theatre, Footnote, Dunedin Fringe, UXBRIDGE) have no type. I've left them blank rather than force one. If performing-arts organisers keep turning up, a "Venue / Festival / Company" category (commissioning relationship) would cover them. That's a small change to `src/lib/org-categories.ts` plus the check constraint.

## Optional — overseas organisers

| Name | Listings | Lean |
|---|---|---|
| Artsin Square | 2 (one joint with Below Grand Gallery) | Skip. Overseas prize; few NZ artists will follow it |
| The Kind Press | 2 | Skip. Overseas publisher, recurring prizes. Add it if writers start following organisations |

## Link listings (after creating the accounts)

Run in the Supabase SQL Editor once the accounts exist. It looks the new accounts up by exact name, so enter the names exactly as in the table above. It only touches listings that have no organiser link yet.

```sql
update public.opportunities o
set organiser_profile_id = p.id
from (values
  ('fa53507b-58e8-43a9-b8df-964bb9eeb8f7', 'New Zealand Film Commission'),
  ('b1508400-d0c3-4671-80df-83a92f60835c', 'New Zealand Film Commission'),
  ('9740c712-7d75-401b-af68-fc9c9bfb2bda', 'New Zealand Film Commission'),
  ('8861444d-d9a8-4f60-aaff-0b90fee508a9', 'New Zealand Film Commission'),
  ('02545418-f2e7-4a06-864e-c92a36848909', 'New Zealand Film Commission'),
  ('1b5113f5-22b4-4386-8dc5-00c423d26588', 'NZ On Air'),
  ('57ee04e9-faaa-4aec-b1dc-4c85fb6b4896', 'NZ On Air'),
  ('599844e5-503f-4c90-9acb-b4588591520b', 'NZ On Air'),
  ('5cb59b4f-4017-4b1b-87ea-12193a3fe220', 'Te Māngai Pāho'),
  ('7b25f449-d160-4cb5-a04c-b6c3e771d087', 'UXBRIDGE Arts and Culture'),
  ('a73c1993-25f8-4a23-ac2e-76d5f226217e', 'UXBRIDGE Arts and Culture'),
  ('aa9d18e3-536b-42a6-966a-d1c2e8c9f267', 'Te Tuhi'),
  ('b44b0594-d42f-42f1-a369-44606a9e87da', 'Auckland Live'),
  ('79c07f3b-7268-4d9c-9dc9-d5f040b858fd', 'Basement Theatre'),
  ('c8b4795d-93c7-4125-baea-177187542a4d', 'Footnote New Zealand Dance'),
  ('193e6379-bbfc-4e46-b8b4-73d48f503773', 'Te Pūkenga Whakaata – New Zealand Portrait Gallery'),
  ('3bf6920a-4f4d-46a7-8f5d-84a056d2c0f1', 'Massey University – Toi Rauwhārangi College of Creative Arts'),
  ('608fe2fb-009c-4124-bd22-d32025949d8b', 'New Zealand Glassworks Te Whare Tūhua o Te Ao'),
  ('aacdf3b8-e65b-4c07-b8d0-47251e20e892', 'Dunedin Fringe Arts Trust')
) as m(opp_id, org_name)
join public.profiles p
  on p.full_name = m.org_name and p.role = 'partner'
where o.id = m.opp_id::uuid
  and o.organiser_profile_id is null;

-- One spelling for the Film Commission's display text.
update public.opportunities
set organiser = 'New Zealand Film Commission (Te Tumu Whakaata Taonga)'
where organiser in ('New Zealand Film Commission (NZFC)', 'New Zealand Film Commission (Te Tumu Whakaata Taonga)');
```

After it runs, check the count: `select count(*) from opportunities where status = 'published' and organiser_profile_id is not null;` should be about 40, counting the 6 links from the matches file.
