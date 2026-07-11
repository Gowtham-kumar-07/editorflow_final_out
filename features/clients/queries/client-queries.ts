import type { ClientFilters } from '../types'

/**
 * Centralized TanStack Query key factory for the clients feature.
 * All client-related queries must use these keys so invalidations are consistent.
 */
export const clientKeys = {
  all:      ['clients'] as const,
  lists:    () => [...clientKeys.all, 'list'] as const,
  list:     (filters?: ClientFilters) => [...clientKeys.lists(), filters ?? {}] as const,
  details:  () => [...clientKeys.all, 'detail'] as const,
  detail:   (id: string) => [...clientKeys.details(), id] as const,
  projects: (id: string) => [...clientKeys.detail(id), 'projects'] as const,
  invoices: (id: string) => [...clientKeys.detail(id), 'invoices'] as const,
  activity: (id: string) => [...clientKeys.detail(id), 'activity'] as const,
}
