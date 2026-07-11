'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  fetchClients,
  fetchClientById,
  fetchClientOptions,
  createClientService,
  updateClientService,
  archiveClientService,
  restoreClientService,
  fetchClientProjects,
  fetchClientInvoices,
  fetchClientActivityLogs,
} from '../services/client-service'
import type { ClientFilters, ClientWithCounts, GetClientsResult, ClientProject, ClientInvoice, ClientActivity } from '../types'
import type { Client, ClientOption } from '@/types/client'
import type { ClientFormValues } from '../schema'

type TypedClient = SupabaseClient<Database>

// ─── Auth helper ──────────────────────────────────────────────────────────────
//
// resolveOrgId calls redirect() — must stay outside try-catch blocks.
//
// Accepts an optional pre-built client so that mutation actions can share ONE
// Supabase client for both org-resolution and the INSERT/UPDATE.  Using two
// separate clients risks a session-token race: proxy.ts can refresh the JWT
// between the two client creations, leaving one client with an expired token —
// auth.uid() then resolves as NULL in Postgres, is_org_member() returns false,
// and the RLS WITH CHECK rejects the mutation with code 42501.
async function resolveOrgId(
  client?: TypedClient
): Promise<{ orgId: string; supabase: TypedClient }> {
  const supabase = client ?? await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileError && profile?.active_organization_id) {
    return { orgId: profile.active_organization_id, supabase }
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

  return { orgId: membership.organization_id, supabase }
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getClients(
  filters: ClientFilters = {}
): Promise<GetClientsResult> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClients(supabase, orgId, filters)
}

export async function getClient(
  id: string
): Promise<ClientWithCounts | null> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClientById(supabase, id, orgId)
}

// ─── Mutation actions ─────────────────────────────────────────────────────────
// Create the Supabase client FIRST, pass it into resolveOrgId() so that both
// org-resolution and the mutation use the SAME authenticated session.

export async function createClientAction(
  values: ClientFormValues
): Promise<ActionResult<Client>> {
  // Single client shared by org-resolution + service insert
  const supabase = await createClient()
  const { orgId } = await resolveOrgId(supabase)
  try {
    const client = await createClientService(supabase, orgId, values)
    return { ok: true, data: client }
  } catch (err) {
    // Surface the full Postgres error object (PostgREST errors are plain objects,
    // not instanceof Error, so the default fallback would swallow them silently)
    const pg = err as Record<string, unknown>
    console.error('[clients] createClient error', { code: pg?.code, message: pg?.message, details: pg?.details, hint: pg?.hint })
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateClientAction(
  id: string,
  values: ClientFormValues
): Promise<ActionResult<Client>> {
  const supabase = await createClient()
  const { orgId } = await resolveOrgId(supabase)
  try {
    const client = await updateClientService(supabase, id, orgId, values)
    return { ok: true, data: client }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function archiveClientAction(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveOrgId(supabase)
  try {
    await archiveClientService(supabase, id, orgId)
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function restoreClientAction(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveOrgId(supabase)
  try {
    await restoreClientService(supabase, id, orgId)
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function getClientOptions(): Promise<ClientOption[]> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClientOptions(supabase, orgId)
}

// ─── Detail section actions ───────────────────────────────────────────────────

export async function getClientProjects(clientId: string): Promise<ClientProject[]> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClientProjects(supabase, clientId, orgId)
}

export async function getClientInvoices(clientId: string): Promise<ClientInvoice[]> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClientInvoices(supabase, clientId, orgId)
}

export async function getClientActivityLogs(clientId: string): Promise<ClientActivity[]> {
  const { orgId, supabase } = await resolveOrgId()
  return fetchClientActivityLogs(supabase, clientId, orgId)
}
