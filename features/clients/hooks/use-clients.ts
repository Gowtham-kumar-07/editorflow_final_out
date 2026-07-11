'use client'

import { useQuery } from '@tanstack/react-query'
import { getClients } from '../actions'
import { clientKeys } from '../queries/client-queries'
import type { ClientFilters } from '../types'

/**
 * Fetches the paginated client list for the current user's active organization.
 * Filters are optional; defaults match the server action defaults.
 */
export function useClients(filters?: ClientFilters) {
  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: () => getClients(filters ?? {}),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}
