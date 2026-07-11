/** Derives a URL-safe slug from an arbitrary display name. */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // strip non-word chars (keep spaces and hyphens)
    .replace(/[\s_]+/g, '-')    // spaces / underscores → single hyphen
    .replace(/-{2,}/g, '-')     // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')    // trim leading/trailing hyphens
    .slice(0, 50)
}

/** Returns true when the string is a valid slug. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}
