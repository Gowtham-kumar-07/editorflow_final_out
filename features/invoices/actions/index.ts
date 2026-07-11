'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InvoiceStatus, OrgRole } from '@/types/supabase'
import type { InvoiceFilters, GetInvoicesResult, InvoiceWithDetails, ProjectOption } from '../types'
import type { InvoiceFormValues } from '../schema'
import {
  fetchInvoices,
  fetchInvoiceById,
  fetchProjectsByClient,
  createInvoiceService,
  updateInvoiceService,
  transitionInvoiceStatusService,
} from '../services/invoice-service'
import {
  canViewInvoices,
  canCreateInvoice,
  canEditInvoice,
  canTransitionInvoiceStatus,
} from '@/lib/permissions'

type TypedClient = SupabaseClient<Database>

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Auth + role context ──────────────────────────────────────────────────────
// Resolves the active org and the caller's role in a single flow.
// Accepts an optional pre-built client so mutations can share one session.

async function resolveContext(
  client?: TypedClient
): Promise<{ orgId: string; userId: string; role: OrgRole; supabase: TypedClient }> {
  const supabase = client ?? (await createClient())

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null

  if (!orgId) {
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (!membership?.organization_id) redirect('/onboarding')
    orgId = membership.organization_id
  }

  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId!)
    .is('deleted_at', null)
    .maybeSingle()

  const role = (mem?.role ?? 'member') as OrgRole

  return { orgId: orgId!, userId: user.id, role, supabase }
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getInvoices(
  filters: InvoiceFilters = {}
): Promise<GetInvoicesResult> {
  const { orgId, role, supabase } = await resolveContext()
  if (!canViewInvoices(role)) {
    return { invoices: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
  }
  return fetchInvoices(supabase, orgId, filters)
}

export async function getInvoice(id: string): Promise<InvoiceWithDetails | null> {
  const { orgId, role, supabase } = await resolveContext()
  if (!canViewInvoices(role)) return null
  return fetchInvoiceById(supabase, id, orgId)
}

export async function getProjectsByClient(
  clientId: string
): Promise<ProjectOption[]> {
  const { orgId, role, supabase } = await resolveContext()
  if (!canViewInvoices(role)) return []
  return fetchProjectsByClient(supabase, orgId, clientId)
}

// ─── Mutation actions ─────────────────────────────────────────────────────────

export async function createInvoiceAction(
  values: InvoiceFormValues
): Promise<ActionResult<{ id: string; invoice_number: string }>> {
  const supabase = await createClient()
  const { orgId, role } = await resolveContext(supabase)

  if (!canCreateInvoice(role)) {
    return { ok: false, error: 'You do not have permission to create invoices.' }
  }

  try {
    const result = await createInvoiceService(supabase, orgId, values)
    return { ok: true, data: result }
  } catch (err) {
    return formatError(err)
  }
}

export async function updateInvoiceAction(
  invoiceId: string,
  values: InvoiceFormValues
): Promise<ActionResult<{ id: string; total: number }>> {
  const supabase = await createClient()
  const { role } = await resolveContext(supabase)

  if (!canEditInvoice(role)) {
    return { ok: false, error: 'You do not have permission to edit invoices.' }
  }

  try {
    const result = await updateInvoiceService(supabase, invoiceId, values)
    return { ok: true, data: result }
  } catch (err) {
    return formatError(err)
  }
}

export async function transitionInvoiceStatusAction(
  invoiceId: string,
  newStatus: InvoiceStatus
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { role } = await resolveContext(supabase)

  if (!canTransitionInvoiceStatus(role)) {
    return { ok: false, error: 'You do not have permission to change invoice status.' }
  }

  try {
    await transitionInvoiceStatusService(supabase, invoiceId, newStatus)
    return { ok: true, data: undefined }
  } catch (err) {
    return formatError(err)
  }
}

// ─── Role helper ─────────────────────────────────────────────────────────────

export async function getInvoiceUserRole(): Promise<OrgRole | null> {
  try {
    const { role } = await resolveContext()
    return role
  } catch {
    return null
  }
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function formatError(err: unknown): { ok: false; error: string } {
  const pg = err as Record<string, unknown>
  console.error('[invoices] mutation error', { code: pg?.code, message: pg?.message, details: pg?.details, hint: pg?.hint })
  // P0001 = custom RAISE EXCEPTION from application triggers — message is user-facing
  if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
  if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
  return { ok: false, error: 'An unexpected error occurred.' }
}
