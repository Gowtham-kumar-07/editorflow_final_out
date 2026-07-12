'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { GetTeamResult } from '../types'
import type { InviteFormValues } from '../schema'
import { logger } from '@/lib/logger'
import {
  fetchTeam,
  updateMemberRoleService,
  updateMemberSpecializationService,
  deactivateMemberService,
  reactivateMemberService,
  createInvitationService,
  cancelInvitationService,
} from '../services/team-service'

type TypedClient = SupabaseClient<Database>
type OrgRole     = Database['public']['Enums']['org_role']

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveContext(
  client?: TypedClient
): Promise<{ orgId: string; userId: string; supabase: TypedClient }> {
  const supabase = client ?? (await createClient())

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.active_organization_id) {
    return { orgId: profile.active_organization_id, userId: user.id, supabase }
  }

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!membership?.organization_id) redirect('/onboarding')
  return { orgId: membership.organization_id, userId: user.id, supabase }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTeam(): Promise<GetTeamResult> {
  const { orgId, supabase } = await resolveContext()
  return fetchTeam(supabase, orgId)
}

export async function getMyRoleAction(): Promise<ActionResult<{ role: OrgRole; userId: string }>> {
  const { orgId, userId, supabase } = await resolveContext()
  const { data, error } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  if (error) {
    logger.error('getMyRoleAction failed', { code: error.code })
    return { ok: false, error: 'Could not retrieve your role. Please try again.' }
  }
  if (!data) return { ok: false, error: 'No role found' }
  return { ok: true, data: { role: data as OrgRole, userId } }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function toActionError(err: unknown, action?: string): ActionResult<never> {
  logger.error('team action failed', { action: action ?? 'unknown', code: err instanceof Error ? err.message.slice(0, 40) : String(err).slice(0, 40) })
  return { ok: false, error: 'An unexpected error occurred. Please try again.' }
}

export async function inviteMemberAction(
  values: InviteFormValues
): Promise<ActionResult<{ token: string; invitation_id: string }>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    const result = await createInvitationService(supabase, orgId, values)
    return { ok: true, data: result }
  } catch (err) {
    return toActionError(err, 'inviteMember')
  }
}

export async function updateMemberRoleAction(
  targetUserId: string,
  newRole: OrgRole
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await updateMemberRoleService(supabase, orgId, targetUserId, newRole)
    return { ok: true, data: undefined }
  } catch (err) {
    return toActionError(err, 'updateMemberRole')
  }
}

export async function updateMemberSpecializationAction(
  targetUserId: string,
  specialization: string | null
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await updateMemberSpecializationService(supabase, orgId, targetUserId, specialization)
    return { ok: true, data: undefined }
  } catch (err) {
    return toActionError(err, 'updateMemberSpecialization')
  }
}

export async function deactivateMemberAction(
  targetUserId: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await deactivateMemberService(supabase, orgId, targetUserId)
    return { ok: true, data: undefined }
  } catch (err) {
    return toActionError(err, 'deactivateMember')
  }
}

export async function reactivateMemberAction(
  targetUserId: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await reactivateMemberService(supabase, orgId, targetUserId)
    return { ok: true, data: undefined }
  } catch (err) {
    return toActionError(err, 'reactivateMember')
  }
}

export async function cancelInvitationAction(
  invitationId: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  await resolveContext(supabase)
  try {
    await cancelInvitationService(supabase, invitationId)
    return { ok: true, data: undefined }
  } catch (err) {
    return toActionError(err, 'cancelInvitation')
  }
}
