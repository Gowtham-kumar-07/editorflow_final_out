'use client'

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
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
  initialOrg:     OrganizationWithRole
  initialAllOrgs: OrganizationWithRole[]
  children: ReactNode
}

export function OrganizationProvider({
  initialOrg,
  initialAllOrgs,
  children,
}: OrganizationProviderProps) {
  const queryClient  = useQueryClient()
  const router       = useRouter()
  const switchingRef = useRef(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // ── Active org as plain React state ───────────────────────────────────────
  // NOT managed via useQuery. After queryClient.clear(), React Query destroys
  // the existing query instance. The useQuery observer re-subscribes on the
  // next render and initialData: initialOrg (the OLD RSC prop) wins the race
  // before router.refresh() delivers the new one — stale name until F5.
  // A direct setState bypasses all of that; it updates synchronously within
  // the React tree with no query observer re-subscription needed.
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(initialOrg)

  // When Next.js RSC sends an updated initialOrg (after router.refresh()),
  // keep state in sync. By the time this fires we've already applied the
  // new org in switchOrganization, so it's a quiet confirmation pass.
  useEffect(() => {
    setOrganization(initialOrg)
  }, [initialOrg])

  // ── All-orgs via React Query ───────────────────────────────────────────────
  // This list only changes when the user joins/leaves an org (not on a plain
  // switch), so the initialData re-population after queryClient.clear() is
  // harmless — we always want the full list restored unchanged.
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

  // ── Refresh ────────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    const supabase = createClient()
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const org = await getUserOrganization(supabase, user.id)
      if (org) setOrganization(org)
    })()
  }, [])

  // ── Switch ─────────────────────────────────────────────────────────────────
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

      // Fetch the new active org and apply it immediately via React state.
      // This updates the header and sidebar before the RSC refresh payload
      // arrives — setState requires no query observer re-subscription.
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const newOrg = user ? await getUserOrganization(supabase, user.id) : null
      if (newOrg) setOrganization(newOrg)

      // Wipe all org-scoped caches so stale data from the old org
      // (dashboard, reports, tasks, invoices, …) cannot leak across.
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
        organization,
        allOrganizations,
        isLoading: false,
        isSwitching,
        refresh,
        switchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}
