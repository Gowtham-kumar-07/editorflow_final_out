/** Protects against CSV formula injection and properly escapes values. */
function sanitizeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Formula injection protection — neutralize leading control characters
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  // Wrap in quotes if value contains comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Builds a CSV string from headers and rows.
 * Prepends a UTF-8 BOM so Excel opens files correctly without an import wizard.
 */
export function buildCsv(
  headers: string[],
  rows:    (string | number | null | undefined)[][],
): string {
  const lines = [
    headers.map(sanitizeCell).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(',')),
  ]
  return '﻿' + lines.join('\r\n')
}

/** Returns standard CSV response headers for Next.js route handlers. */
export function csvHeaders(filename: string): HeadersInit {
  return {
    'Content-Type':        'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control':       'no-store',
  }
}
