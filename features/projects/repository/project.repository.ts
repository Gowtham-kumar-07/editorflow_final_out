import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ProjectFilters } from '../types'

type TypedClient  = SupabaseClient<Database>
type ProjectRow   = Database['public']['Tables']['projects']['Row']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectUpdate = Database['public']['Tables']['projects']['Update']

type ProjectWithClientRow = ProjectRow & {
  client: { id: string; company_name: string } | null
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function dbFindProjects(
  supabase: TypedClient,
  organizationId: string,
  filters: ProjectFilters
): Promise<{ rows: ProjectWithClientRow[]; count: number }> {
  const {
    search,
    status,
    priority,
    clientId,
    sortBy    = 'created_at',
    sortOrder = 'desc',
    page      = 1,
    pageSize  = 20,
  } = filters

  const offset = (page - 1) * pageSize

  let query = supabase
    .from('projects')
    .select('*, client:clients(id, company_name)', { count: 'exact' })
    .eq('organization_id', organizationId)

  if (status === 'archived') {
    query = query.eq('status', 'archived')
  } else if (status) {
    query = query.eq('status', status)
  } else {
    query = query.neq('status', 'archived')
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []) as unknown as ProjectWithClientRow[], count: count ?? 0 }
}

export async function dbFindProjectById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<ProjectWithClientRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, company_name)')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as ProjectWithClientRow
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function dbCreateProject(
  supabase: TypedClient,
  data: ProjectInsert
): Promise<ProjectRow> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      ...data,
      status:   data.status   ?? 'planning',
      priority: data.priority ?? 'medium',
      progress: data.progress ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[dbCreateProject]', { code: error.code, message: error.message, hint: error.hint })
    throw error
  }
  return project
}

export async function dbUpdateProject(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  data: ProjectUpdate
): Promise<ProjectRow> {
  // Strip status: only changeable via update_project_status / archive_project RPCs.
  const safeData = { ...data } as Record<string, unknown>
  delete safeData.status

  const { data: project, error } = await supabase
    .from('projects')
    .update({ ...safeData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) throw error
  return project
}

export async function dbArchiveProject(
  supabase: TypedClient,
  id: string,
  organizationId: string  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  // Routes through the archive_project SECURITY DEFINER RPC so that
  // the column-level REVOKE on projects.status is not a barrier.
  const { error } = await supabase.rpc('archive_project', { p_project_id: id })
  if (error) throw new Error(error.message)
}

export async function dbUpdateProjectStatus(
  supabase: TypedClient,
  projectId: string,
  newStatus: Database['public']['Enums']['project_status']
): Promise<void> {
  const { error } = await supabase.rpc('update_project_status', {
    p_project_id: projectId,
    p_new_status: newStatus,
  })
  if (error) throw new Error(error.message)
}

export async function dbRestoreProject(
  supabase: TypedClient,
  id: string,
  organizationId: string  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  // Routes through update_project_status RPC (archived → active transition).
  const { error } = await supabase.rpc('update_project_status', {
    p_project_id: id,
    p_new_status: 'active',
  })
  if (error) throw new Error(error.message)
}
