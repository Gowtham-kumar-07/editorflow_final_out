import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  PaymentRecord,
  PaymentListItem,
  PaymentFilters,
  GetPaymentsResult,
  PaymentSummaryMetrics,
  PayableInvoiceOption,
  ClientOption,
} from '../types'

type TypedClient = SupabaseClient<Database>

// ─── Per-invoice list (invoice detail page) ───────────────────────────────────

export async function dbGetPaymentsByInvoice(
  supabase: TypedClient,
  invoiceId: string
): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapRow)
}

// ─── Single payment by ID ─────────────────────────────────────────────────────

export async function dbGetPaymentById(
  supabase: TypedClient,
  paymentId: string
): Promise<PaymentRecord | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  if (!data) return null

  return mapRow(data)
}

// ─── Org-wide ledger (paginated + filtered) ───────────────────────────────────

export async function dbGetPaymentsForOrg(
  supabase: TypedClient,
  orgId: string,
  filters: PaymentFilters = {}
): Promise<GetPaymentsResult> {
  const pageSize = filters.pageSize ?? 20
  const page     = filters.page ?? 1
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  // ── Step 0: resolve search to matching invoice_ids ─────────────────────────
  let searchInvoiceIds: string[] | null = null
  if (filters.search?.trim()) {
    const s = filters.search.trim()

    // Find clients matching company_name
    const { data: matchedClients } = await supabase
      .from('clients')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('company_name', `%${s}%`)
      .limit(100)

    const clientIds = (matchedClients ?? []).map((c) => c.id)

    // Find invoices by invoice_number OR client
    let invQuery = supabase
      .from('invoices')
      .select('id')
      .eq('organization_id', orgId)
      .is('deleted_at', null)

    if (clientIds.length > 0) {
      invQuery = invQuery.or(`invoice_number.ilike.%${s}%,client_id.in.(${clientIds.join(',')})`)
    } else {
      invQuery = invQuery.ilike('invoice_number', `%${s}%`)
    }

    const { data: matchedInvoices } = await invQuery.limit(500)
    searchInvoiceIds = (matchedInvoices ?? []).map((i) => i.id)
  }

  // ── Step 1: main payments query ───────────────────────────────────────────
  let query = supabase
    .from('payments')
    .select(
      `*,
       invoices(id, invoice_number, currency, client_id,
         clients(id, company_name))`,
      { count: 'exact' }
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  // Status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  // Payment method filter
  if (filters.method && filters.method !== 'all') {
    query = query.eq('payment_method', filters.method)
  }

  // Date range
  if (filters.dateFrom) query = query.gte('payment_date', filters.dateFrom)
  if (filters.dateTo)   query = query.lte('payment_date', filters.dateTo)

  // Search — match reference OR invoice_id in set
  if (filters.search?.trim() && searchInvoiceIds !== null) {
    const s = filters.search.trim()
    if (searchInvoiceIds.length > 0) {
      query = query.or(
        `transaction_reference.ilike.%${s}%,invoice_id.in.(${searchInvoiceIds.join(',')})`
      )
    } else {
      query = query.ilike('transaction_reference', `%${s}%`)
    }
  }

  query = query
    .order('payment_date', { ascending: false })
    .order('created_at',   { ascending: false })
    .range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  // ── Step 2: enrich with recorder profiles ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const recorderIds = [...new Set(rows.map((r) => r.recorded_by).filter(Boolean) as string[])]
  const profileMap: Record<string, string> = {}

  if (recorderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', recorderIds)

    for (const p of (profiles ?? [])) {
      profileMap[p.id] = p.full_name || p.email || p.id
    }
  }

  const payments: PaymentListItem[] = rows.map((row) => {
    const invoice = row.invoices as {
      id: string
      invoice_number: string
      currency: string
      client_id: string
      clients: { id: string; company_name: string } | null
    } | null

    return {
      ...mapRow(row),
      invoice_number:   invoice?.invoice_number ?? '',
      invoice_currency: invoice?.currency ?? 'USD',
      client_id:        invoice?.clients?.id ?? invoice?.client_id ?? '',
      client_name:      invoice?.clients?.company_name ?? '',
      recorded_by_name: row.recorded_by ? (profileMap[row.recorded_by] ?? null) : null,
    }
  })

  const total = count ?? 0
  return { payments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// ─── Summary metrics ──────────────────────────────────────────────────────────

export async function dbGetPaymentSummary(
  supabase: TypedClient,
  orgId: string
): Promise<PaymentSummaryMetrics> {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [orgResult, completedResult, outstandingResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('default_currency')
      .eq('id', orgId)
      .maybeSingle(),

    supabase
      .from('payments')
      // base_amount is the FX-adjusted equivalent in the org's base currency
      .select('base_amount, payment_date')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .is('deleted_at', null),

    supabase
      .from('invoices')
      .select('balance_due, currency')
      .eq('organization_id', orgId)
      .in('status', ['sent', 'overdue', 'partial'])
      .is('deleted_at', null),
  ])

  const baseCurrency      = orgResult.data?.default_currency ?? 'USD'
  const completedPayments = completedResult.data ?? []
  const activeInvoices    = outstandingResult.data ?? []

  // Use base_amount (FX-adjusted) so cross-currency payments are correctly summed
  const total_collected = completedPayments
    .reduce((s, p) => s + Number(p.base_amount ?? 0), 0)

  const collected_this_month = completedPayments
    .filter((p) => p.payment_date >= monthStart)
    .reduce((s, p) => s + Number(p.base_amount ?? 0), 0)

  const payments_this_month = completedPayments
    .filter((p) => p.payment_date >= monthStart).length

  // Outstanding: only count invoices in the org's base currency to avoid
  // cross-currency addition (future invoices have no base_amount snapshot)
  const outstanding_balance = activeInvoices
    .filter((i) => (i.currency ?? '').toUpperCase() === baseCurrency.toUpperCase())
    .reduce((s, i) => s + Number(i.balance_due), 0)

  return { total_collected, collected_this_month, outstanding_balance, payments_this_month, base_currency: baseCurrency }
}

// ─── Clients for payment dialog ───────────────────────────────────────────────

export async function dbGetOrgClients(
  supabase: TypedClient,
  orgId: string
): Promise<ClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('company_name')

  if (error) throw error
  return (data ?? []).map((c) => ({ id: c.id, company_name: c.company_name }))
}

// ─── Payable invoices for a client ───────────────────────────────────────────

export async function dbGetPayableInvoicesForClient(
  supabase: TypedClient,
  orgId: string,
  clientId: string
): Promise<PayableInvoiceOption[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, balance_due, currency')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .in('status', ['sent', 'overdue', 'partial'])
    .is('deleted_at', null)
    .gt('balance_due', 0)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((i) => ({
    id:             i.id,
    invoice_number: i.invoice_number,
    balance_due:    Number(i.balance_due),
    currency:       i.currency,
  }))
}

// ─── Mutations (unchanged) ────────────────────────────────────────────────────

export async function dbRecordPayment(
  supabase: TypedClient,
  params: {
    invoice_id:           string
    amount:               number
    payment_date:         string
    payment_method:       string
    transaction_ref:      string | null
    notes:                string | null
    // FX snapshot computed server-side in the action layer
    transaction_currency: string
    base_currency:        string
    fx_rate:              number
    base_amount:          number
    fx_rate_source:       string
    fx_rate_date:         string
  }
): Promise<{ payment_id: string; new_status: string; total_paid: number; balance_due: number }> {
  const { data, error } = await supabase.rpc('record_invoice_payment', {
    p_invoice_id:           params.invoice_id,
    p_amount:               params.amount,
    p_payment_date:         params.payment_date,
    p_payment_method:       params.payment_method,
    // Generated types declare these as non-optional TEXT but the DB accepts NULL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_transaction_ref:      params.transaction_ref as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_notes:                params.notes           as any,
    p_transaction_currency: params.transaction_currency,
    p_base_currency:        params.base_currency,
    p_fx_rate:              params.fx_rate,
    p_base_amount:          params.base_amount,
    p_fx_rate_source:       params.fx_rate_source,
    p_fx_rate_date:         params.fx_rate_date,
  })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as any
  return {
    payment_id:  result.payment_id,
    new_status:  result.new_status,
    total_paid:  Number(result.total_paid),
    balance_due: Number(result.balance_due),
  }
}

export async function dbVoidPayment(
  supabase: TypedClient,
  paymentId: string,
  voidReason: string
): Promise<void> {
  const { error } = await supabase.rpc('void_invoice_payment', {
    p_payment_id:  paymentId,
    p_void_reason: voidReason,
  })
  if (error) throw error
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): PaymentRecord {
  return {
    id:                    row.id,
    invoice_id:            row.invoice_id,
    organization_id:       row.organization_id,
    recorded_by:           row.recorded_by ?? null,
    amount:                Number(row.amount),
    payment_date:          row.payment_date,
    payment_method:        row.payment_method ?? '',
    transaction_reference: row.transaction_reference ?? null,
    notes:                 row.notes ?? null,
    status:                row.status,
    voided_at:             row.voided_at ?? null,
    voided_by:             row.voided_by ?? null,
    void_reason:           row.void_reason ?? null,
    created_at:            row.created_at,
    updated_at:            row.updated_at,
    // FX snapshot — present after 20260727 migration; fallback for older rows
    transaction_currency:  row.transaction_currency ?? '',
    base_currency:         row.base_currency         ?? '',
    fx_rate:               Number(row.fx_rate   ?? 1),
    base_amount:           Number(row.base_amount ?? row.amount),
    fx_rate_source:        row.fx_rate_source   ?? 'fallback_1',
    fx_rate_date:          row.fx_rate_date     ?? null,
  }
}
