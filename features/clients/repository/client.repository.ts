import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ActivityType, Json } from '@/types/supabase'
import type { ClientFilters } from '../types'

type TypedClient = SupabaseClient<Database>
type ClientRow    = Database['public']['Tables']['clients']['Row']
type ClientInsert = Database['public']['Tables']['clients']['Insert']
type ClientUpdate = Database['public']['Tables']['clients']['Update']

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function dbFindClients(
  supabase: TypedClient,
  organizationId: string,
  filters: ClientFilters
): Promise<{ rows: ClientRow[]; count: number }> {
  const {
    search,
    statusFilter = 'active',
    sortBy    = 'created_at',
    sortOrder = 'desc',
    page      = 1,
    pageSize  = 20,
  } = filters

  const offset = (page - 1) * pageSize

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)

  if (statusFilter === 'archived') {
    query = query.eq('status', 'archived')
  } else if (statusFilter === 'inactive') {
    query = query.eq('status', 'inactive')
  } else if (statusFilter !== 'all') {
    // default: show everything except archived
    query = query.neq('status', 'archived')
  }

  if (search?.trim()) {
    const term = search.trim()
    query = query.or(
      `company_name.ilike.%${term}%,contact_name.ilike.%${term}%,email.ilike.%${term}%`
    )
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: data ?? [], count: count ?? 0 }
}

export async function dbFindClientById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function dbFindClientOptions(
  supabase: TypedClient,
  organizationId: string
): Promise<{ id: string; company_name: string }[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', organizationId)
    .neq('status', 'archived')
    .order('company_name', { ascending: true })

  if (error) return []
  return data ?? []
}

// Used internally by the service to enrich list and detail results with counts.
export async function dbGetCountsByClientIds(
  supabase: TypedClient,
  organizationId: string,
  clientIds: string[]
): Promise<{ projectCounts: Record<string, number>; invoiceCounts: Record<string, number> }> {
  const [projectsRes, invoicesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('client_id')
      .eq('organization_id', organizationId)
      .in('client_id', clientIds),
    supabase
      .from('invoices')
      .select('client_id')
      .eq('organization_id', organizationId)
      .in('client_id', clientIds),
  ])

  const projectCounts: Record<string, number> = {}
  for (const p of projectsRes.data ?? []) {
    projectCounts[p.client_id] = (projectCounts[p.client_id] ?? 0) + 1
  }

  const invoiceCounts: Record<string, number> = {}
  for (const inv of invoicesRes.data ?? []) {
    if (inv.client_id) {
      invoiceCounts[inv.client_id] = (invoiceCounts[inv.client_id] ?? 0) + 1
    }
  }

  return { projectCounts, invoiceCounts }
}

export async function dbGetClientCounts(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<{ project_count: number; invoice_count: number }> {
  const [projectsRes, invoicesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id)
      .eq('organization_id', organizationId),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id)
      .eq('organization_id', organizationId),
  ])
  return {
    project_count: projectsRes.count ?? 0,
    invoice_count: invoicesRes.count ?? 0,
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function dbCreateClient(
  supabase: TypedClient,
  data: ClientInsert
): Promise<ClientRow> {
  const { data: client, error } = await supabase
    .from('clients')
    .insert(data)
    .select()
    .single()

  if (error) {
    console.error('[dbCreateClient]', { code: error.code, message: error.message, hint: error.hint })
    throw error
  }
  return client
}

export async function dbUpdateClient(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  data: ClientUpdate
): Promise<ClientRow> {
  const { data: client, error } = await supabase
    .from('clients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) throw error
  return client
}

export async function dbArchiveClient(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) throw error
}

export async function dbRestoreClient(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) throw error
}

// ─── Detail section reads ─────────────────────────────────────────────────────

type ProjectRow    = Database['public']['Tables']['projects']['Row']
type InvoiceRow    = Database['public']['Tables']['invoices']['Row']
type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row']

export async function dbGetClientProjects(
  supabase: TypedClient,
  clientId: string,
  organizationId: string
): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('client_id', clientId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function dbGetClientInvoices(
  supabase: TypedClient,
  clientId: string,
  organizationId: string
): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function dbGetClientActivityLogs(
  supabase: TypedClient,
  clientId: string,
  organizationId: string,
  limit = 20
): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_id', clientId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

// ─── Activity ─────────────────────────────────────────────────────────────────

// Non-fatal: errors are logged but never propagated so a logging failure
// cannot roll back a successful client mutation.
export async function dbLogActivity(
  supabase: TypedClient,
  organizationId: string,
  entityId: string,
  activityType: ActivityType,
  metadata?: Json | null
): Promise<void> {
  const { error } = await supabase.rpc('log_activity', {
    p_organization_id: organizationId,
    p_entity_type:     'client',
    p_entity_id:       entityId,
    p_activity_type:   activityType,
    p_metadata:        metadata ?? null,
  })
  if (error) {
    console.error('[log_activity]', error.message)
  }
}
