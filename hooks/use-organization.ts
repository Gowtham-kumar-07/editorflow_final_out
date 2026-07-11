'use client'

import { useOrganizationContext } from '@/components/providers/organization-provider'

/**
 * Returns the current organization and helpers from the nearest
 * OrganizationProvider. Must be called within the (dashboard) route group.
 */
export function useOrganization() {
  return useOrganizationContext()
}
