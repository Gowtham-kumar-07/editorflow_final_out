/**
 * Safe internal redirect utilities.
 *
 * Only accepts relative paths that start with "/" but not "//".
 * Rejects absolute URLs, protocol-relative URLs, and javascript: URIs.
 */

export function isSafeRedirect(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('//')) return false
  // Reject any string that looks like an absolute URL (scheme:...)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return false
  return url.startsWith('/')
}

export function safeRedirect(
  url: string | null | undefined,
  fallback = '/dashboard'
): string {
  return isSafeRedirect(url) ? url : fallback
}
