'use client'

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/supabase/client'
import { getUserOrganization, getAllUserOrganizations } from '@/services/organization.service'
import { switchOrganizationAction } from '@/features/orgs/actions'
import type { OrganizationWithRole } from '@/types/organization'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const ORGANIZATION_QUERY_KEY      = ['organization']      as const
export const ALL_ORGANIZATIONS_QUERY_KEY = ['all-organizations'] as const

// ─── Context ──────────────────────────────────────────────────────────────────

type OrganizationContextValue = {
  organization:       OrganizationWithRole | null
  allOrganizations:   OrganizationWithRole[]
  isLoading:          boolean
  isSwitching:        boolean
  refresh:            () => void
  switchOrganization: (orgId: string) => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization:       null,
  allOrganizations:   [],
  isLoading:          false,
  isSwitching:        false,
  refresh:            () => {},
  switchOrganization: async () => {},
})

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrganizationContext(): OrganizationContextValue {
  return useContext(OrganizationContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type OrganizationProviderProps = {
  /**
   * Active organization fetched server-side — used as initialData so React
   * Query treats it as already-fetched and skips the client loading flash.
   */
  initialOrg:     OrganizationWithRole
  /**
   * All organizations the user belongs to, fetched server-side.
   */
  initialAllOrgs: OrganizationWithRole[]
  children: ReactNode
}

export function OrganizationProvider({
  initialOrg,
  initialAllOrgs,
  children,
}: OrganizationProviderProps) {
  const queryClient   = useQueryClient()
  const router        = useRouter()
  const switchingRef  = useRef(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Active organization query — respects active_organization_id via getUserOrganization
  const { data: organization, isLoading } = useQuery<OrganizationWithRole | null>({
    queryKey: ORGANIZATION_QUERY_KEY,
    queryFn:  async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      return getUserOrganization(supabase, user.id)
    },
    initialData: initialOrg,
    staleTime:   5 * 60 * 1000,
  })

  // All-orgs query — populates the org switcher list
  const { data: allOrganizations = [] } = useQuery<OrganizationWithRole[]>({
    queryKey: ALL_ORGANIZATIONS_QUERY_KEY,
    queryFn:  async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      return getAllUserOrganizations(supabase, user.id)
    },
    initialData: initialAllOrgs,
    staleTime:   5 * 60 * 1000,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY })
  }, [queryClient])

  const switchOrganization = useCallback(async (orgId: string) => {
    if (switchingRef.current) return
    switchingRef.current = true
    setIsSwitching(true)
    try {
      const { error } = await switchOrganizationAction(orgId)
      if (error) {
        toast.error(error)
        return
      }
      // Wipe all org-scoped React Query caches so no stale data leaks
      // across the org boundary after the switch.
      queryClient.clear()
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('Failed to switch organization. Please try again.')
    } finally {
      switchingRef.current = false
      setIsSwitching(false)
    }
  }, [queryClient, router])

  return (
    <OrganizationContext.Provider
      value={{
        organization:       organization ?? null,
        allOrganizations,
        isLoading,
        isSwitching,
        refresh,
        switchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}
