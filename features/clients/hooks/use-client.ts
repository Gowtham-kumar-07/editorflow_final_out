'use client'

import { useQuery } from '@tanstack/react-query'
import { getClient } from '../actions'
import { clientKeys } from '../queries/client-queries'

/**
 * Fetches a single client by ID, with project and invoice counts.
 * Disabled when id is falsy.
 */
export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => getClient(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  })
}
