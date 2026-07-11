import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ActivityType, Json } from '@/types/supabase'
import type { TaskFilters, TaskWithDetails, TaskComment, TaskActivity, OrgMember, ProjectOption } from '../types'

type TypedClient  = SupabaseClient<Database>
type TaskRow      = Database['public']['Tables']['tasks']['Row']
type TaskInsert   = Database['public']['Tables']['tasks']['Insert']
type TaskUpdate   = Database['public']['Tables']['tasks']['Update']

// ─── List ─────────────────────────────────────────────────────────────────────

export async function dbFindTasks(
  supabase: TypedClient,
  organizationId: string,
  filters: TaskFilters
): Promise<{ rows: TaskWithDetails[]; count: number }> {
  const {
    search,
    status,
    priority,
    projectId,
    assigneeId,
    sortBy    = 'created_at',
    sortOrder = 'desc',
    page      = 1,
    pageSize  = 20,
    showDeleted = false,
  } = filters

  const offset = (page - 1) * pageSize

  let query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)

  if (showDeleted) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  if (status)     query = query.eq('status', status)
  if (priority)   query = query.eq('priority', priority)
  if (projectId)  query = query.eq('project_id', projectId)
  if (assigneeId) query = query.eq('assigned_to', assigneeId)

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`)
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  const tasks = data ?? []
  if (tasks.length === 0) return { rows: [], count: 0 }

  // Enrich with project names and assignee profiles (two-step)
  const projectIds  = [...new Set(tasks.map((t) => t.project_id))]
  const assigneeIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[]

  const [projectsRes, profilesRes] = await Promise.all([
    supabase.from('projects').select('id, name, project_files_url').in('id', projectIds),
    assigneeIds.length > 0
      ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', assigneeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] }),
  ])

  const projectMap = Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p]))
  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p]))

  const rows: TaskWithDetails[] = tasks.map((t) => ({
    ...t,
    project:  projectMap[t.project_id]  ?? null,
    assignee: t.assigned_to ? (profileMap[t.assigned_to] ?? null) : null,
  }))

  return { rows, count: count ?? 0 }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function dbFindTaskById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<TaskWithDetails | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  if (!data) return null

  const [projectRes, profileRes] = await Promise.all([
    supabase.from('projects').select('id, name, project_files_url').eq('id', data.project_id).maybeSingle(),
    data.assigned_to
      ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...data,
    project:  projectRes.data ?? null,
    assignee: profileRes.data ?? null,
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function dbCreateTask(
  supabase: TypedClient,
  data: TaskInsert
): Promise<TaskRow> {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      ...data,
      status:   data.status   ?? 'todo',
      priority: data.priority ?? 'medium',
      position: data.position ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[dbCreateTask]', { code: error.code, message: error.message })
    throw error
  }
  return task
}

export async function dbUpdateTask(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  data: TaskUpdate
): Promise<TaskRow> {
  // Strip workflow-controlled columns: status and completed_at may only be
  // changed via the transition_task_status RPC. Direct writes are blocked by
  // column-level REVOKE and would fail at the database layer anyway.
  const safeData = { ...data } as Record<string, unknown>
  delete safeData.status
  delete safeData.completed_at

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ ...safeData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) throw error
  return task
}

export async function dbTransitionTaskStatus(
  supabase: TypedClient,
  taskId: string,
  newStatus: Database['public']['Enums']['task_status']
): Promise<void> {
  const { error } = await supabase.rpc('transition_task_status', {
    p_task_id:    taskId,
    p_new_status: newStatus,
  })
  if (error) throw new Error(error.message)
}

export async function dbArchiveTask(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) throw error
}

// ─── Activity logging ─────────────────────────────────────────────────────────

export async function dbLogTaskActivity(
  supabase: TypedClient,
  organizationId: string,
  taskId: string,
  activityType: ActivityType,
  metadata?: Json | null
): Promise<void> {
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: organizationId,
    p_entity_type:     'task',
    p_entity_id:       taskId,
    p_activity_type:   activityType,
    p_metadata:        metadata ?? null,
  })
  if (error) {
    console.error('[log_activity:task]', error.message)
  }
}

// ─── Comment write ────────────────────────────────────────────────────────────

export async function dbCreateTaskComment(
  supabase: TypedClient,
  taskId: string,
  userId: string,
  comment: string
): Promise<void> {
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, comment })

  if (error) throw error
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function dbGetTaskComments(
  supabase: TypedClient,
  taskId: string
): Promise<TaskComment[]> {
  const { data: comments, error } = await supabase
    .from('task_comments')
    .select('id, task_id, user_id, comment, edited_at, created_at')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!comments || comments.length === 0) return []

  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))] as string[]
  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    if (profiles) profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
  }

  return comments.map((c) => ({
    id:         c.id,
    task_id:    c.task_id,
    user_id:    c.user_id,
    comment:    c.comment,
    edited_at:  c.edited_at,
    created_at: c.created_at,
    user:       c.user_id ? (profileMap[c.user_id] ?? null) : null,
  }))
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function dbGetTaskActivityLogs(
  supabase: TypedClient,
  taskId: string,
  organizationId: string
): Promise<TaskActivity[]> {
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, activity_type, metadata, created_at')
    .eq('entity_id', taskId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  if (!logs || logs.length === 0) return []

  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[]
  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    if (profiles) profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
  }

  return logs.map((l) => ({
    id:            l.id,
    user_id:       l.user_id,
    activity_type: l.activity_type,
    metadata:      l.metadata as Record<string, unknown> | null,
    created_at:    l.created_at,
    user:          l.user_id ? (profileMap[l.user_id] ?? null) : null,
  }))
}

// ─── Supporting lookups ───────────────────────────────────────────────────────

export async function dbGetOrgMembers(
  supabase: TypedClient,
  organizationId: string
): Promise<OrgMember[]> {
  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (error) throw error
  if (!memberships || memberships.length === 0) return []

  const userIds = memberships.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  return (profiles ?? []).map((p) => ({
    id:         p.id,
    full_name:  p.full_name,
    avatar_url: p.avatar_url,
  }))
}

export async function dbGetProjectOptions(
  supabase: TypedClient,
  organizationId: string
): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('organization_id', organizationId)
    .neq('status', 'archived')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }))
}
