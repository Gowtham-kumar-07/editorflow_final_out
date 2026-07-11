export const globalSearchKeys = {
  all:   ['global-search']             as const,
  query: (q: string) => [...globalSearchKeys.all, q] as const,
}
