export interface CurrencyGroup<T> {
  currency: string
  total:    number
  items:    T[]
}

/**
 * Groups items by currency. Never sums across currencies.
 * Returns groups sorted by total descending (highest revenue first).
 */
export function groupByCurrency<T>(
  items:       T[],
  getCurrency: (item: T) => string,
  getAmount:   (item: T) => number,
): CurrencyGroup<T>[] {
  const map = new Map<string, { total: number; items: T[] }>()

  for (const item of items) {
    const currency = getCurrency(item).toUpperCase()
    const group = map.get(currency) ?? { total: 0, items: [] }
    group.items.push(item)
    group.total += getAmount(item)
    map.set(currency, group)
  }

  return Array.from(map.entries())
    .map(([currency, g]) => ({ currency, total: g.total, items: g.items }))
    .sort((a, b) => b.total - a.total)
}

/** Returns all unique currency codes present in an array, sorted. */
export function extractCurrencies<T>(
  items:       T[],
  getCurrency: (item: T) => string,
): string[] {
  const set = new Set<string>()
  for (const item of items) set.add(getCurrency(item).toUpperCase())
  return Array.from(set).sort()
}
