import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ProjectStats, TaskWithAssignee, TeamMember, ActivityItem } from '../types/workspace'

type TypedClient = SupabaseClient<Database>

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function dbGetProjectStats(
  supabase: TypedClient,
  projectId: string,
  orgId: string
): Promise<ProjectStats> {
  const [tasks, members, invoices] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, status', { count: 'exact' })
      .eq('project_id', projectId)
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    supabase
      .from('project_members')
      .select('id', { count: 'exact' })
      .eq('project_id', projectId)
      .is('deleted_at', null),
    // Count invoices linked via invoice_projects (multi-project) OR the legacy project_id column
    supabase
      .from('invoice_projects')
      .select('invoice_id', { count: 'exact' })
      .eq('project_id', projectId)
      .eq('organization_id', orgId),
  ])

  if (tasks.error) throw tasks.error
  if (members.error) throw members.error
  if (invoices.error) throw invoices.error

  const totalTasks     = tasks.count ?? 0
  const completedTasks = (tasks.data ?? []).filter((t) => t.status === 'completed').length

  return {
    totalTasks,
    completedTasks,
    teamMembers: members.count ?? 0,
    invoices:    invoices.count ?? 0,
  }
}

// ─── Tasks preview ────────────────────────────────────────────────────────────

export async function dbGetProjectTasksPreview(
  supabase: TypedClient,
  projectId: string,
  orgId: string
): Promise<TaskWithAssignee[]> {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, assigned_to')
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error
  if (!tasks || tasks.length === 0) return []

  const assigneeIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[]

  let profileMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> = {}
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', assigneeIds)
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
    }
  }

  return tasks.map((t) => ({
    id:       t.id,
    title:    t.title,
    status:   t.status,
    priority: t.priority,
    due_date: t.due_date,
    assignee: t.assigned_to ? (profileMap[t.assigned_to] ?? null) : null,
  }))
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export async function dbGetProjectTeam(
  supabase: TypedClient,
  projectId: string
): Promise<TeamMember[]> {
  const { data: members, error } = await supabase
    .from('project_members')
    .select('id, user_id, role')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!members || members.length === 0) return []

  const userIds = members.map((m) => m.user_id)

  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)
  if (profiles) {
    profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
  }

  return members.map((m) => ({
    id:      m.id,
    user_id: m.user_id,
    role:    m.role,
    profile: profileMap[m.user_id] ?? null,
  }))
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function dbGetProjectActivity(
  supabase: TypedClient,
  projectId: string,
  orgId: string
): Promise<ActivityItem[]> {
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, activity_type, entity_type, metadata, created_at')
    .eq('entity_id', projectId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) throw error
  if (!logs || logs.length === 0) return []

  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[]

  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
    }
  }

  return logs.map((l) => ({
    id:            l.id,
    user_id:       l.user_id,
    activity_type: l.activity_type,
    entity_type:   l.entity_type,
    metadata:      l.metadata as Record<string, unknown> | null,
    created_at:    l.created_at,
    user:          l.user_id ? (profileMap[l.user_id] ?? null) : null,
  }))
}
