import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Client } from '@/types/client'
import type { ClientFilters, ClientWithCounts, GetClientsResult } from '../types'
import { formValuesToClientData, type ClientFormValues } from '../schema'
import {
  dbFindClients,
  dbFindClientById,
  dbFindClientOptions,
  dbGetClientCounts,
  dbGetCountsByClientIds,
  dbCreateClient,
  dbUpdateClient,
  dbArchiveClient,
  dbRestoreClient,
  dbLogActivity,
  dbGetClientProjects,
  dbGetClientInvoices,
  dbGetClientActivityLogs,
} from '../repository/client.repository'
import type { ClientProject, ClientInvoice, ClientActivity } from '../types'

type TypedClient = SupabaseClient<Database>

export const CLIENT_PAGE_SIZE = 20

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchClients(
  supabase: TypedClient,
  organizationId: string,
  filters: ClientFilters = {}
): Promise<GetClientsResult> {
  const pageSize = filters.pageSize ?? CLIENT_PAGE_SIZE
  const page     = filters.page     ?? 1

  const { rows, count } = await dbFindClients(supabase, organizationId, { ...filters, pageSize })

  let clientsWithCounts: ClientWithCounts[] = rows.map((c) => ({
    ...c,
    project_count: 0,
    invoice_count: 0,
  }))

  if (rows.length > 0) {
    const { projectCounts, invoiceCounts } = await dbGetCountsByClientIds(
      supabase,
      organizationId,
      rows.map((c) => c.id)
    )
    clientsWithCounts = rows.map((c) => ({
      ...c,
      project_count: projectCounts[c.id] ?? 0,
      invoice_count: invoiceCounts[c.id] ?? 0,
    }))
  }

  return {
    clients: clientsWithCounts,
    total: count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  }
}

export async function fetchClientById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<ClientWithCounts | null> {
  const client = await dbFindClientById(supabase, id, organizationId)
  if (!client) return null
  const counts = await dbGetClientCounts(supabase, id, organizationId)
  return { ...client, ...counts }
}

export async function fetchClientOptions(
  supabase: TypedClient,
  organizationId: string
): Promise<{ id: string; company_name: string }[]> {
  return dbFindClientOptions(supabase, organizationId)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createClientService(
  supabase: TypedClient,
  organizationId: string,
  values: ClientFormValues
): Promise<Client> {
  const data   = formValuesToClientData(values)
  const client = await dbCreateClient(supabase, { ...data, organization_id: organizationId })
  await dbLogActivity(supabase, organizationId, client.id, 'created', {
    company_name: client.company_name,
  })
  return client
}

export async function updateClientService(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  values: ClientFormValues
): Promise<Client> {
  const data   = formValuesToClientData(values)
  const client = await dbUpdateClient(supabase, id, organizationId, data)
  await dbLogActivity(supabase, organizationId, id, 'updated', {
    company_name: client.company_name,
  })
  return client
}

export async function archiveClientService(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  await dbArchiveClient(supabase, id, organizationId)
  await dbLogActivity(supabase, organizationId, id, 'deleted')
}

export async function restoreClientService(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  await dbRestoreClient(supabase, id, organizationId)
  await dbLogActivity(supabase, organizationId, id, 'updated', { restored: true })
}

// ─── Detail section services ──────────────────────────────────────────────────

export async function fetchClientProjects(
  supabase: TypedClient,
  clientId: string,
  organizationId: string
): Promise<ClientProject[]> {
  const rows = await dbGetClientProjects(supabase, clientId, organizationId)
  return rows.map((p) => ({
    id:         p.id,
    name:       p.name,
    status:     p.status,
    priority:   p.priority,
    progress:   p.progress,
    due_date:   p.due_date,
    created_at: p.created_at,
  }))
}

export async function fetchClientInvoices(
  supabase: TypedClient,
  clientId: string,
  organizationId: string
): Promise<ClientInvoice[]> {
  const rows = await dbGetClientInvoices(supabase, clientId, organizationId)
  return rows.map((inv) => ({
    id:             inv.id,
    invoice_number: inv.invoice_number,
    status:         inv.status,
    issue_date:     inv.issue_date,
    due_date:       inv.due_date,
    total:          inv.total,
    currency:       inv.currency ?? 'USD',
    created_at:     inv.created_at,
  }))
}

export async function fetchClientActivityLogs(
  supabase: TypedClient,
  clientId: string,
  organizationId: string
): Promise<ClientActivity[]> {
  const rows = await dbGetClientActivityLogs(supabase, clientId, organizationId)
  return rows.map((a) => ({
    id:            a.id,
    activity_type: a.activity_type,
    entity_type:   a.entity_type,
    metadata:      a.metadata,
    created_at:    a.created_at,
  }))
}
