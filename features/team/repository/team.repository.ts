import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { TeamMember, TeamInvitation } from '../types'

type TypedClient = SupabaseClient<Database>
type OrgRole     = Database['public']['Enums']['org_role']
type TaskStatus  = Database['public']['Enums']['task_status']

// Tasks that count as "active workload" (not done, not awaiting review)
const ACTIVE_WORKLOAD_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked']
// All non-completed statuses fetched for workload computation
const OPEN_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'review']

// ─── Members ──────────────────────────────────────────────────────────────────

export async function dbGetTeamMembers(
  supabase: TypedClient,
  organizationId: string
): Promise<TeamMember[]> {
  // Fetch all memberships (active + inactive) with profile data
  const { data: memberships, error: mErr } = await supabase
    .from('organization_memberships')
    .select('id, user_id, organization_id, role, specialization, deleted_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (mErr) throw mErr
  if (!memberships || memberships.length === 0) return []

  const userIds = memberships.map((m) => m.user_id)

  // Fetch profiles for all members (new policy allows org members to see team profiles)
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', userIds)

  if (pErr) throw pErr

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Fetch open tasks to compute workload (explicitly include only valid statuses)
  const today = new Date().toISOString()
  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('assigned_to, status, due_date')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('status', OPEN_TASK_STATUSES)
    .in('assigned_to', userIds)

  if (tErr) throw tErr

  // Compute workload per user
  // active  = todo | in_progress | blocked
  // in_review = review
  // overdue = past due_date AND status in active set (review tasks not flagged as overdue)
  type WorkloadMap = Record<string, { active: number; in_review: number; overdue: number }>
  const workload: WorkloadMap = {}
  for (const t of tasks ?? []) {
    if (!t.assigned_to) continue
    if (!workload[t.assigned_to]) workload[t.assigned_to] = { active: 0, in_review: 0, overdue: 0 }
    if (t.status === 'review') {
      workload[t.assigned_to].in_review++
    } else if (ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus)) {
      workload[t.assigned_to].active++
      if (t.due_date && t.due_date < today) {
        workload[t.assigned_to].overdue++
      }
    }
  }

  return memberships.map((m) => ({
    id:              m.id,
    user_id:         m.user_id,
    organization_id: m.organization_id,
    role:            m.role as OrgRole,
    specialization:  m.specialization,
    is_active:       m.deleted_at === null,
    joined_at:       m.created_at,
    profile:         profileMap[m.user_id] ?? { id: m.user_id, full_name: null, avatar_url: null, email: null },
    workload:        workload[m.user_id] ?? { active: 0, in_review: 0, overdue: 0 },
  }))
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export async function dbGetInvitations(
  supabase: TypedClient,
  organizationId: string
): Promise<TeamInvitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, organization_id, email, role, specialization, invited_by, expires_at, accepted_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    role: row.role as OrgRole,
  }))
}

// ─── Member management RPCs ───────────────────────────────────────────────────

export async function dbUpdateMemberRole(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string,
  newRole: OrgRole
): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', {
    p_org_id:    orgId,
    p_target_id: targetUserId,
    p_new_role:  newRole,
  })
  if (error) throw new Error(error.message)
}

export async function dbUpdateMemberSpecialization(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string,
  specialization: string | null
): Promise<void> {
  const { error } = await supabase.rpc('update_member_specialization', {
    p_org_id:         orgId,
    p_target_id:      targetUserId,
    p_specialization: specialization as string,
  })
  if (error) throw new Error(error.message)
}

export async function dbDeactivateMember(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string
): Promise<void> {
  const { error } = await supabase.rpc('deactivate_member', {
    p_org_id:    orgId,
    p_target_id: targetUserId,
  })
  if (error) throw new Error(error.message)
}

export async function dbReactivateMember(
  supabase: TypedClient,
  orgId: string,
  targetUserId: string
): Promise<void> {
  const { error } = await supabase.rpc('reactivate_member', {
    p_org_id:    orgId,
    p_target_id: targetUserId,
  })
  if (error) throw new Error(error.message)
}

// ─── Invitation RPCs ──────────────────────────────────────────────────────────

export async function dbCreateInvitation(
  supabase: TypedClient,
  orgId: string,
  email: string,
  role: OrgRole,
  specialization?: string | null
): Promise<{ token: string; invitation_id: string }> {
  const { data, error } = await supabase.rpc('create_invitation', {
    p_org_id:         orgId,
    p_email:          email,
    p_role:           role,
    p_specialization: specialization ?? undefined,
  })
  if (error) throw new Error(error.message)
  return data as { token: string; invitation_id: string }
}

export async function dbCancelInvitation(
  supabase: TypedClient,
  invitationId: string
): Promise<void> {
  const { error } = await supabase.rpc('cancel_invitation', {
    p_invitation_id: invitationId,
  })
  if (error) throw new Error(error.message)
}
