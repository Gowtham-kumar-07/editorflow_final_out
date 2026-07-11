import type { IncomeFilters } from '../types'

export const incomeKeys = {
  all:     ['income'] as const,
  list:    (filters: IncomeFilters = {}) => ['income', 'list', filters] as const,
  summary: () => ['income', 'summary'] as const,
}
