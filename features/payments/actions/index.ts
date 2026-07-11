'use server'

import { redirect }     from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { OrgRole } from '@/types/supabase'
import {
  dbRecordPayment,
  dbVoidPayment,
  dbGetPaymentsForOrg,
  dbGetPaymentSummary,
  dbGetOrgClients,
  dbGetPayableInvoicesForClient,
} from '../repository/payment.repository'
import { recordPaymentSchema, voidPaymentSchema } from '../schema'
import type { RecordPaymentInput, VoidPaymentInput } from '../schema'
import type {
  PaymentFilters,
  GetPaymentsResult,
  PaymentSummaryMetrics,
  PayableInvoiceOption,
  ClientOption,
} from '../types'
import { canViewPayments, canRecordPayment, canVoidPayment } from '@/lib/permissions'
import { getFxRate } from '@/features/fx/fx-service'

type ActionResult<T = undefined> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Shared context resolution ────────────────────────────────────────────────

async function resolvePaymentContext() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null

  if (!orgId) {
    const { data: mem } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (!mem?.organization_id) redirect('/onboarding')
    orgId = mem.organization_id
  }

  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId!)
    .is('deleted_at', null)
    .maybeSingle()

  const role = (mem?.role ?? 'member') as OrgRole

  return { supabase, orgId: orgId!, role }
}

// ─── Role helper (used by page) ───────────────────────────────────────────────

export async function getPaymentUserRole(): Promise<OrgRole | null> {
  try {
    const { role } = await resolvePaymentContext()
    return role
  } catch {
    return null
  }
}

export async function getPaymentOrgContext(): Promise<{ orgId: string; role: OrgRole } | null> {
  try {
    const { orgId, role } = await resolvePaymentContext()
    return { orgId, role }
  } catch {
    return null
  }
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getPaymentsAction(
  filters: PaymentFilters = {}
): Promise<GetPaymentsResult> {
  const { orgId, role } = await resolvePaymentContext()
  if (!canViewPayments(role)) {
    return { payments: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
  }
  const supabase = await createClient()
  return dbGetPaymentsForOrg(supabase, orgId, filters)
}

export async function getPaymentSummaryAction(): Promise<PaymentSummaryMetrics> {
  const { orgId, role } = await resolvePaymentContext()
  if (!canViewPayments(role)) {
    return { total_collected: 0, collected_this_month: 0, outstanding_balance: 0, payments_this_month: 0, base_currency: 'USD' }
  }
  const supabase = await createClient()
  return dbGetPaymentSummary(supabase, orgId)
}

export async function getOrgClientsAction(): Promise<ClientOption[]> {
  const { orgId, role } = await resolvePaymentContext()
  if (!canRecordPayment(role)) return []
  const supabase = await createClient()
  return dbGetOrgClients(supabase, orgId)
}

export async function getPayableInvoicesForClientAction(
  clientId: string
): Promise<PayableInvoiceOption[]> {
  const { orgId, role } = await resolvePaymentContext()
  if (!canRecordPayment(role)) return []
  const supabase = await createClient()
  return dbGetPayableInvoicesForClient(supabase, orgId, clientId)
}

// ─── Mutation actions ─────────────────────────────────────────────────────────

export async function recordPaymentAction(
  invoiceId: string,
  input: RecordPaymentInput
): Promise<ActionResult<{ payment_id: string; new_status: string; balance_due: number }>> {
  const parsed = recordPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { role } = await resolvePaymentContext()
  if (!canRecordPayment(role)) {
    return { ok: false, error: 'You do not have permission to record payments.' }
  }

  try {
    const supabase = await createClient()

    // Resolve invoice currency and org base currency for FX snapshot
    const { data: invoiceRow } = await supabase
      .from('invoices')
      .select('currency, organizations(default_currency)')
      .eq('id', invoiceId)
      .maybeSingle()

    const txCurrency   = invoiceRow?.currency ?? 'USD'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseCurrency = (invoiceRow?.organizations as any)?.default_currency ?? 'USD'

    // Server fetches the live rate — never trusts browser-supplied rate
    const { rate, source, date } = await getFxRate(txCurrency, baseCurrency)
    const baseAmount = Math.round(parsed.data.amount * rate * 100) / 100

    const result = await dbRecordPayment(supabase, {
      invoice_id:           invoiceId,
      amount:               parsed.data.amount,
      payment_date:         parsed.data.payment_date,
      payment_method:       parsed.data.payment_method,
      transaction_ref:      parsed.data.transaction_ref ?? null,
      notes:                parsed.data.notes ?? null,
      transaction_currency: txCurrency,
      base_currency:        baseCurrency,
      fx_rate:              rate,
      base_amount:          baseAmount,
      fx_rate_source:       source,
      fx_rate_date:         date,
    })
    return { ok: true, data: result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to record payment'
    return { ok: false, error: msg }
  }
}

export async function voidPaymentAction(
  paymentId: string,
  input: VoidPaymentInput
): Promise<ActionResult> {
  const parsed = voidPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { role } = await resolvePaymentContext()
  if (!canVoidPayment(role)) {
    return { ok: false, error: 'Only owners and admins can void payments.' }
  }

  try {
    const supabase = await createClient()
    await dbVoidPayment(supabase, paymentId, parsed.data.void_reason)
    return { ok: true, data: undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to void payment'
    return { ok: false, error: msg }
  }
}
