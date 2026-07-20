'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { GetTeamResult } from '../types'
import type { InviteFormValues } from '../schema'
import { logger } from '@/lib/logger'
import { APP_URL } from '@/lib/constants'
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

function makeAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Sends the Supabase invite email.  The link routes through /auth/callback so
// the PKCE code exchange happens before landing on the invite accept page.
async function dispatchInviteEmail(email: string, token: string): Promise<boolean> {
  const next = encodeURIComponent(`/invite/accept?token=${token}`)
  const redirectTo = `${APP_URL}/auth/callback?next=${next}`
  const admin = makeAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) {
    // "User already registered" is expected for existing Supabase users.
    // All other errors are genuine delivery failures.
    logger.warn('dispatchInviteEmail: inviteUserByEmail failed', { email, message: error.message })
    return false
  }
  return true
}

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
): Promise<ActionResult<{ token: string; invitation_id: string; email_sent: boolean }>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    const result = await createInvitationService(supabase, orgId, values)
    const email_sent = await dispatchInviteEmail(values.email, result.token)
    return { ok: true, data: { ...result, email_sent } }
  } catch (err) {
    return toActionError(err, 'inviteMember')
  }
}

export async function resendInvitationAction(
  invitationId: string
): Promise<ActionResult<{ email_sent: boolean }>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    // Fetch the invitation with its token — this is safe because it's server-only.
    // The security boundary is the org membership check in resolveContext above.
    const { data: inv, error: fetchErr } = await supabase
      .from('invitations')
      .select('email, token, expires_at, accepted_at')
      .eq('id', invitationId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchErr || !inv) return { ok: false, error: 'Invitation not found.' }
    if (inv.accepted_at) return { ok: false, error: 'This invitation has already been accepted.' }
    if (new Date(inv.expires_at) < new Date()) {
      return { ok: false, error: 'This invitation has expired. Please create a new one.' }
    }

    const email_sent = await dispatchInviteEmail(inv.email, inv.token as string)
    return { ok: true, data: { email_sent } }
  } catch (err) {
    return toActionError(err, 'resendInvitation')
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
