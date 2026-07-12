'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { TaskFilters, GetTasksResult, TaskWithDetails, TaskComment, TaskActivity, OrgMember, ProjectOption, TaskStatus } from '../types'
import type { TaskFormValues } from '../schema'
import type { OrgRole } from '@/types/supabase'
import {
  fetchTasks,
  fetchTaskById,
  fetchTaskComments,
  fetchTaskActivity,
  fetchOrgMembers,
  fetchProjectOptions,
  createTaskService,
  updateTaskService,
  archiveTaskService,
  transitionTaskStatusService,
  addCommentService,
} from '../services/task-service'
import {
  canCreateTask,
  canEditTask,
  canArchiveTask,
} from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { capturePayrollFxSnapshot, type PayrollFxSnapshot } from '@/features/fx/fx-service'

type TypedClient = SupabaseClient<Database>

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

  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (memberError) throw new Error(`Failed to load membership: ${memberError.message}`)
  if (!membership?.organization_id) redirect('/onboarding')

  return { orgId: membership.organization_id, userId: user.id, supabase }
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTasks(
  filters: TaskFilters = {}
): Promise<GetTasksResult> {
  const { orgId, supabase } = await resolveContext()
  return fetchTasks(supabase, orgId, filters)
}

export async function getTask(
  id: string
): Promise<TaskWithDetails | null> {
  const { orgId, supabase } = await resolveContext()
  return fetchTaskById(supabase, id, orgId)
}

export async function getTaskComments(
  taskId: string
): Promise<ActionResult<TaskComment[]>> {
  try {
    const { supabase } = await resolveContext()
    const comments = await fetchTaskComments(supabase, taskId)
    return { ok: true, data: comments }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function getTaskActivity(
  taskId: string
): Promise<ActionResult<TaskActivity[]>> {
  try {
    const { orgId, supabase } = await resolveContext()
    const activity = await fetchTaskActivity(supabase, taskId, orgId)
    return { ok: true, data: activity }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  const { orgId, supabase } = await resolveContext()
  return fetchOrgMembers(supabase, orgId)
}

export async function getProjectOptions(): Promise<ProjectOption[]> {
  const { orgId, supabase } = await resolveContext()
  return fetchProjectOptions(supabase, orgId)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTaskAction(
  values: TaskFormValues
): Promise<ActionResult<{ id: string; title: string }>> {
  const supabase = await createClient()
  const { orgId, userId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canCreateTask(role)) {
    return { ok: false, error: 'Only project managers and admins can create tasks.' }
  }
  try {
    const task = await createTaskService(supabase, orgId, userId, values)
    return { ok: true, data: { id: task.id, title: task.title } }
  } catch (err) {
    const pg = err as Record<string, unknown>
    console.error('[tasks] createTask error', { code: pg?.code, message: pg?.message, details: pg?.details, hint: pg?.hint })
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateTaskAction(
  id: string,
  values: TaskFormValues
): Promise<ActionResult<{ id: string; title: string }>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canEditTask(role)) {
    return { ok: false, error: 'Only project managers and admins can edit tasks.' }
  }
  try {
    const task = await updateTaskService(supabase, id, orgId, values)
    return { ok: true, data: { id: task.id, title: task.title } }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function archiveTaskAction(
  id: string,
  title: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canArchiveTask(role)) {
    return { ok: false, error: 'Only project managers and admins can archive tasks.' }
  }
  try {
    await archiveTaskService(supabase, id, orgId, title)
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function transitionTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await transitionTaskStatusService(supabase, taskId, orgId, newStatus)

    // When a task is completed the DB trigger creates an income record.
    // Enrich it with the live FX snapshot (triggers cannot call HTTP).
    if (newStatus === 'completed') {
      enrichIncomeWithFx(supabase, taskId, orgId).catch((err) => {
        logger.error('income FX enrichment failed', {
          detail: err instanceof Error ? err.message.slice(0, 60) : 'unknown',
        })
      })
    }

    return { ok: true, data: undefined }
  } catch (err) {
    logger.error('transitionTaskStatus failed', { detail: err instanceof Error ? err.message.slice(0, 40) : 'unknown' })
    return { ok: false, error: 'Could not update task status. Please try again.' }
  }
}

async function enrichIncomeWithFx(
  supabase: TypedClient,
  taskId:   string,
  orgId:    string
): Promise<void> {
  const [taskRes, incomeRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('amount, task_currency, assigned_to')
      .eq('id', taskId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('member_income')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle(),
  ])

  const task = taskRes.data
  if (!task || !task.assigned_to || (task.amount ?? 0) <= 0 || !incomeRes.data) return

  const profileRes = await supabase
    .from('profiles')
    .select('preferred_currency')
    .eq('id', task.assigned_to)
    .maybeSingle()

  const memberCurrency = profileRes.data?.preferred_currency ?? 'USD'
  const taskCurrency   = task.task_currency ?? 'USD'

  let snapshot: PayrollFxSnapshot
  try {
    snapshot = await capturePayrollFxSnapshot(task.amount, taskCurrency, memberCurrency)
  } catch (err) {
    logger.error('FX rate unavailable — income record left without conversion', {
      taskId,
      from:   taskCurrency,
      to:     memberCurrency,
      detail: err instanceof Error ? err.message.slice(0, 80) : 'unknown',
    })
    return
  }

  const { error } = await supabase.rpc('update_income_fx_snapshot', {
    p_task_id:          taskId,
    p_member_currency:  snapshot.member_currency,
    p_converted_amount: snapshot.converted_amount,
    p_fx_rate:          snapshot.fx_rate,
    p_fx_rate_source:   snapshot.fx_rate_source,
    p_fx_snapshot_date: snapshot.fx_snapshot_date,
  })
  if (error) throw new Error(error.message)
}

export async function getTaskIncomeAction(taskId: string): Promise<{
  original_amount:   number | null
  original_currency: string | null
  member_currency:   string | null
  fx_rate:           number | null
  fx_snapshot_date:  string | null
  converted_amount:  number | null
} | null> {
  try {
    const supabase = await createClient()
    const { orgId } = await resolveContext(supabase)

    const { data } = await supabase
      .from('member_income')
      .select('original_amount, original_currency, member_currency, fx_rate, fx_snapshot_date, converted_amount')
      .eq('task_id', taskId)
      .eq('organization_id', orgId)
      .maybeSingle()

    return data ?? null
  } catch {
    return null
  }
}

export async function getUserRole(): Promise<OrgRole | null> {
  try {
    const { orgId, supabase } = await resolveContext()
    const { data } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
    return (data as OrgRole) ?? null
  } catch {
    return null
  }
}

export async function addTaskCommentAction(
  taskId: string,
  comment: string
): Promise<ActionResult<void>> {
  if (!comment.trim()) return { ok: false, error: 'Comment cannot be empty.' }
  const supabase = await createClient()
  const { orgId, userId } = await resolveContext(supabase)
  try {
    await addCommentService(supabase, orgId, taskId, userId, comment.trim())
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function getCurrentUser(): Promise<{
  id: string
  full_name: string | null
  avatar_url: string | null
} | null> {
  try {
    const { userId, supabase } = await resolveContext()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}
