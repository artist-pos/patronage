/**
 * The place line shown on an artist card on a regional page: the taxonomy town
 * when we have one, else the first place the artist typed. Country is only said
 * when it is not the obvious one. The freeform text can run long, and a card
 * only has room for a town.
 */
export function regionalTownLabel(
  a: { city?: string | null; city_id?: string | null; country?: string | null },
  regionName: string,
  cityNameById: Map<string, string>
): string | null {
  const typed = a.city?.split(/[\/,]/)[0]?.trim() || null;
  // "Tāmaki Makaurau Auckland" is the region said twice; the region name is enough.
  const town =
    (a.city_id && cityNameById.get(a.city_id)) ||
    (typed && typed.toLowerCase().includes(regionName.toLowerCase()) ? regionName : typed);
  const country = a.country && a.country !== "NZ" ? a.country : null;
  return [town, country].filter(Boolean).join(", ") || null;
}
