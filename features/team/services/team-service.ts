import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { GetTeamResult, TeamMember, TeamInvitation } from '../types'
import type { InviteFormValues } from '../schema'
import {
  dbGetTeamMembers,
  dbGetInvitations,
  dbUpdateMemberRole,
  dbUpdateMemberSpecialization,
  dbDeactivateMember,
  dbReactivateMember,
  dbCreateInvitation,
  dbCancelInvitation,
} from '../repository/team.repository'

type TypedClient = SupabaseClient<Database>
type OrgRole     = Database['public']['Enums']['org_role']

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchTeam(
  supabase: TypedClient,
  organizationId: string
): Promise<GetTeamResult> {
  const [members, invitations] = await Promise.all([
    dbGetTeamMembers(supabase, organizationId),
    dbGetInvitations(supabase, organizationId),
  ])
  return { members, invitations }
}

export async function fetchTeamMembers(
  supabase: TypedClient,
  organizationId: string
): Promise<TeamMember[]> {
  return dbGetTeamMembers(supabase, organizationId)
}

export async function fetchInvitations(
  supabase: TypedClient,
  organizationId: string
): Promise<TeamInvitation[]> {
  return dbGetInvitations(supabase, organizationId)
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function updateMemberRoleService(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string,
  newRole: OrgRole
): Promise<void> {
  return dbUpdateMemberRole(supabase, orgId, targetUserId, newRole)
}

export async function updateMemberSpecializationService(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string,
  specialization: string | null
): Promise<void> {
  return dbUpdateMemberSpecialization(supabase, orgId, targetUserId, specialization)
}

export async function deactivateMemberService(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string
): Promise<void> {
  return dbDeactivateMember(supabase, orgId, targetUserId)
}

export async function reactivateMemberService(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string
): Promise<void> {
  return dbReactivateMember(supabase, orgId, targetUserId)
}

export async function createInvitationService(
  supabase: TypedClient,
  orgId: string,
  values: InviteFormValues
): Promise<{ token: string; invitation_id: string }> {
  return dbCreateInvitation(supabase, orgId, values.email, values.role as OrgRole, values.specialization ?? null)
}

export async function cancelInvitationService(
  supabase: TypedClient,
  invitationId: string
): Promise<void> {
  return dbCancelInvitation(supabase, invitationId)
}
