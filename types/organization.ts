import type { Database, OrgRole } from './supabase'

export type { OrgRole }

export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

export type OrganizationMembership =
  Database['public']['Tables']['organization_memberships']['Row']
export type OrganizationMembershipInsert =
  Database['public']['Tables']['organization_memberships']['Insert']

/** Organization enriched with the calling user's membership role */
export type OrganizationWithRole = Organization & {
  role: OrgRole
}

export type CreateOrganizationParams = {
  name: string
  slug: string
  logoUrl: string | null
  /** No longer used — the create_organization RPC reads auth.uid() internally. */
  ownerId?: string
}
