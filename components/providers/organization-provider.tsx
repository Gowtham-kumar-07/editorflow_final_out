'use client'

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/supabase/client'
import { getUserOrganization } from '@/services/organization.service'
import type { OrganizationWithRole } from '@/types/organization'

// ─── Query key ────────────────────────────────────────────────────────────────

export const ORGANIZATION_QUERY_KEY = ['organization'] as const

// ─── Context ──────────────────────────────────────────────────────────────────

type OrganizationContextValue = {
  organization: OrganizationWithRole | null
  isLoading: boolean
  /** Invalidates the cached organization and re-fetches from Supabase. */
  refresh: () => void
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  isLoading: false,
  refresh: () => {},
})

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrganizationContext(): OrganizationContextValue {
  return useContext(OrganizationContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type OrganizationProviderProps = {
  /**
   * Organization fetched server-side and passed in as the initial cache value.
   * Prevents a loading flash on first render — TanStack Query treats this as
   * already-fetched data and will only refetch when staleTime elapses.
   */
  initialOrg: OrganizationWithRole
  children: ReactNode
}

export function OrganizationProvider({ initialOrg, children }: OrganizationProviderProps) {
  const queryClient = useQueryClient()

  const { data: organization, isLoading } = useQuery<OrganizationWithRole | null>({
    queryKey: ORGANIZATION_QUERY_KEY,
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      return getUserOrganization(supabase, user.id)
    },
    initialData: initialOrg,
    // Do not refetch immediately — the server-rendered value is fresh.
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY })
  }, [queryClient])

  return (
    <OrganizationContext.Provider
      value={{ organization: organization ?? null, isLoading, refresh }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}
