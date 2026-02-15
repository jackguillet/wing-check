/**
 * Convert a spot name to a URL-friendly slug.
 *
 * - Strips diacritics (NFD decomposition)
 * - Removes apostrophes / okinas
 * - Replaces non-alphanumeric runs with a single hyphen
 * - Trims leading/trailing hyphens
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/['\u02BB\u2018\u2019]/g, "") // apostrophes & okinas
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, ""); // trim edges
}

/**
 * Generate a slug that doesn't collide with `existingSlugs`.
 * Appends `-2`, `-3`, etc. on collision.
 */
export function generateUniqueSlug(
  name: string,
  existingSlugs: Set<string>,
): string {
  const base = slugify(name);
  if (!existingSlugs.has(base)) return base;
  let n = 2;
  while (existingSlugs.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
