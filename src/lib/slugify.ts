export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")   // keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateWorkSlug(title: string | null, year: number | null): string {
  if (!title) return "";
  const base = slugify(title);
  if (!base) return "";
  return year ? `${base}-${year}` : base;
}
