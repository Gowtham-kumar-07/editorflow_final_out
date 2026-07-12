'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { OrgRole } from '@/types/supabase'
import type { IncomeFilters, GetIncomeResult, IncomeSummary } from '../types'
import type { MarkPaidValues } from '../schema'
import { dbGetIncome, dbGetIncomeSummary } from '../repository/income.repository'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveContext() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

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

  const { data: memRole } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId!)
    .is('deleted_at', null)
    .maybeSingle()

  const role: OrgRole = (memRole?.role as OrgRole | null) ?? 'member'

  return { supabase, orgId: orgId!, userId: user.id, role }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getIncomeAction(filters: IncomeFilters = {}): Promise<GetIncomeResult> {
  const { supabase, orgId, userId, role } = await resolveContext()

  // Members can only see their own income — enforce regardless of filter
  const effectiveFilters: IncomeFilters = role === 'member'
    ? { ...filters, memberId: userId }
    : filters

  return dbGetIncome(supabase, orgId, effectiveFilters)
}

export async function getIncomeSummaryAction(): Promise<IncomeSummary> {
  const { supabase, orgId, userId, role } = await resolveContext()

  const memberId = role === 'member' ? userId : undefined

  // Fetch org payroll currency as fallback (used when there are no income records yet)
  const { data: orgData } = await supabase
    .from('organizations')
    .select('default_payroll_currency, default_currency')
    .eq('id', orgId)
    .maybeSingle()

  const orgPayrollCurrency = orgData?.default_payroll_currency ?? orgData?.default_currency ?? undefined

  return dbGetIncomeSummary(supabase, orgId, memberId, orgPayrollCurrency)
}

export async function markIncomePaidAction(
  incomeId: string,
  values:   MarkPaidValues
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, role } = await resolveContext()

  if (role === 'member') {
    return { ok: false, error: 'Permission denied: only managers can mark income as paid.' }
  }

  const { error } = await supabase.rpc('mark_member_income_paid', {
    p_income_id:             incomeId,
    p_payment_date:          values.payment_date,
    p_payment_method:        values.payment_method,
    p_transaction_reference: values.transaction_reference || undefined,
    p_notes:                 values.notes || undefined,
  })

  if (error) {
    if (error.message.includes('Permission denied')) return { ok: false, error: 'Permission denied.' }
    if (error.message.includes('already paid'))      return { ok: false, error: 'This income record is already marked as paid.' }
    return { ok: false, error: 'Failed to update income record.' }
  }

  return { ok: true }
}
