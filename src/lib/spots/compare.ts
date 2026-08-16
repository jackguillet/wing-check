/** Parse `/compare?spots=a,b,c` into at most 3 unique slugs. */
export function parseCompareSlugs(
  raw: string | string[] | undefined,
): string[] {
  const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const part of joined.split(/[,\s]+/)) {
    const slug = part.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length === 3) break;
  }
  return slugs;
}

export function compareHref(slugs: string[]): string {
  const unique = parseCompareSlugs(slugs.join(","));
  if (unique.length === 0) return "/compare";
  return `/compare?spots=${unique.join(",")}`;
}
