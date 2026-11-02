# Organiser link matches — for review

Drafted 2026-11-01 from a read-only pass over the live database, for feature 1 of [social-phase-1.md](social-phase-1.md) (follow organisations). **Nothing has been written.** Tick or strike rows, then the confirmed set can be applied with the SQL at the bottom.

Method: each published opportunity without an `organiser_profile_id` was compared with the 35 partner accounts by normalised name and by website domain.

## Summary

| | Count |
|---|---|
| Published opportunities | 105 |
| Already linked | 15 |
| Unlinked | 90 |
| Suggested links below (confident) | 6 |
| Borderline | 3 |
| Rejected false matches | 8 |
| No partner account exists for the organiser | ~73 |

**The finding that matters:** matching can only take linked listings from 15 to about 21. Most organisers don't have a partner account at all, so coverage for following depends on creating (shadow) accounts for the organisers that recur, not on better matching. See the last section.

## Confident matches — recommend linking

| Opportunity | Organiser text | Partner | Basis |
|---|---|---|---|
| Exhibit Your Art in Paris – Huge Gallery, 5–7 Feb 2027 | Huge Gallery | @huge-gallery | exact name |
| Exhibit Your Art in Lyon – Huge Gallery, 4–6 Dec 2026 | Huge Gallery | @huge-gallery | exact name |
| Exhibit Your Art in London – Huge Gallery, 27–29 Nov 2026 | Huge Gallery | @huge-gallery | exact name |
| NZ at Venice 2028 Artist and Curator | Creative New Zealand | @creative-new-zealand | exact name + domain |
| ArtFundMe Autumn 2026: $1,000 Grant for Artists | ArtFundMe | @artfundme | exact name |
| Adam NZ Play Award 2026 | Playmarket & the Adam Foundation | @playmarket | name + domain (co-run) |

## Borderline — your call

Creative Communities Scheme rounds. They're funded by Creative New Zealand but run by the council, so artists following Creative NZ may or may not expect them. My lean: **don't link**. These belong to the councils.

| Opportunity organiser | Deadline |
|---|---|
| Waitomo District Council / Creative New Zealand | 2026-11-01 |
| Upper Hutt City Council / Creative New Zealand | 2026-11-02 |
| Central Otago District Council (Creative New Zealand) | 2027-02-12 |

## Rejected — false matches from shared words

Blackbird Foundation → patronage_nz_foundation · Awesome Foundation → patronage_nz_foundation · The Waipā Creative Trail → Creative New Zealand · Creative Matters → Creative New Zealand · Whangarei Art Trust → Font Public Art Trust · Decagon Gallery → Huge Gallery · The Ou Gallery → Huge Gallery · Communication Arts → Ōrākei Arts.

## Organisers with no account — candidates for shadow accounts

Recurring or NZ-based organisers worth an account so artists can follow them. Counts are published listings.

| Organiser | Listings | Note |
|---|---|---|
| New Zealand Film Commission | 5 | Entered under two spellings: "(Te Tumu Whakaata Taonga)" and "(NZFC)". Normalise the organiser text too |
| NZ On Air | 3 | One listing is joint with Te Māngai Pāho |
| Te Māngai Pāho | 2 | Including the joint listing |
| UXBRIDGE Arts and Culture | 2 | Two spellings |
| Artsin Square | 2 | One joint with Below Grand Gallery |
| The Kind Press | 2 | |
| Te Tuhi, Auckland Live, Basement Theatre, Footnote New Zealand Dance, Te Pūkenga Whakaata – NZ Portrait Gallery, Dunedin Fringe Arts Trust, NZ Glassworks, Massey University Toi Rauwhārangi | 1 each | Established NZ organisations likely to list again |

International one-offs (Les Rencontres d'Arles, World Photography Organisation, MacDowell, DAAD and similar) can stay unlinked for now.

## Apply (after review)

Edit the list to the rows you confirm, then run in the Supabase SQL Editor:

```sql
update public.opportunities o
set organiser_profile_id = m.partner_id::uuid
from (values
  ('f48301cf-c148-4c2c-9bf3-3dd684b74a65', '66b0e0a1-d103-40fd-b2c1-91cc0bc3acff'), -- Huge Gallery, Lyon
  ('5878f221-b6c2-457f-81e2-5a807e31df2c', '66b0e0a1-d103-40fd-b2c1-91cc0bc3acff'), -- Huge Gallery, Paris
  ('848d075a-73ad-4851-b25f-959cd1eda4d2', '66b0e0a1-d103-40fd-b2c1-91cc0bc3acff'), -- Huge Gallery, London
  ('2a5f5f0e-106c-4538-ba91-0b58943d8e00', 'e994eea1-3b33-42e6-ad26-96ded560184c'), -- Creative NZ, Venice 2028
  ('6a9fce73-855b-4145-b72e-f318aeb0547d', '6ea1d843-1774-4561-be1c-0221f208d022'), -- ArtFundMe Autumn 2026
  ('08e88551-fef3-4fa3-95dd-ddde36694785', '74de7e58-d686-41fb-b3ae-ecbf350369ac')  -- Adam NZ Play Award 2026
) as m(opp_id, partner_id)
where o.id = m.opp_id::uuid
  and o.organiser_profile_id is null;
```

The `is null` guard means re-running it can't overwrite a link someone set by hand.
