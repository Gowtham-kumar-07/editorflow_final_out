import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InvoiceStatus } from '@/types/supabase'
import type {
  InvoiceFilters,
  InvoiceListItem,
  InvoiceWithDetails,
  InvoiceItemRow,
  ProjectOption,
} from '../types'

type TypedClient = SupabaseClient<Database>

// ─── List ─────────────────────────────────────────────────────────────────────

export async function dbFindInvoices(
  supabase: TypedClient,
  organizationId: string,
  filters: InvoiceFilters = {}
): Promise<{ rows: InvoiceListItem[]; count: number }> {
  const pageSize = filters.pageSize ?? 20
  const page     = filters.page     ?? 1
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  let query = supabase
    .from('invoices')
    .select(
      `id, organization_id, client_id,
       invoice_number, status, issue_date, due_date,
       currency, total, created_at,
       clients!inner(company_name),
       invoice_projects(project_id, projects(name))`,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .range(from, to)

  if (filters.search?.trim()) {
    const s = filters.search.trim()
    query = query.or(
      `invoice_number.ilike.%${s}%,clients.company_name.ilike.%${s}%`
    )
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as InvoiceStatus)
  }

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  const sortField = filters.sortBy   ?? 'created_at'
  const ascending = filters.sortOrder === 'asc'
  query = query.order(sortField, { ascending })

  const { data, error, count } = await query
  if (error) throw error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: InvoiceListItem[] = (data ?? []).map((row: any) => {
    const links = (row.invoice_projects ?? []) as Array<{ projects: { name: string } | null }>
    const projectNames = links
      .map((l) => l.projects?.name)
      .filter((n): n is string => !!n)

    return {
      id:             row.id             as string,
      organization_id: row.organization_id as string,
      client_id:      row.client_id      as string,
      invoice_number: row.invoice_number as string,
      status:         row.status         as InvoiceStatus,
      issue_date:     row.issue_date     as string,
      due_date:       row.due_date       as string | null,
      currency:       row.currency       as string,
      total:          Number(row.total),
      created_at:     row.created_at     as string,
      client_name:    (row.clients as { company_name: string } | null)?.company_name ?? '',
      project_names:  projectNames,
    }
  })

  return { rows, count: count ?? 0 }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function dbFindInvoiceById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<InvoiceWithDetails | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(id, company_name, contact_name, email, phone, address, gst_tax_id),
      invoice_projects(project_id, projects(id, name)),
      invoice_items(*)
    `)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any

  const linkedProjects = ((raw.invoice_projects ?? []) as Array<{
    project_id: string
    projects: { id: string; name: string } | null
  }>)
    .map((ip) => ip.projects)
    .filter((p): p is { id: string; name: string } => !!p)

  return {
    ...data,
    paid_amount: Number(raw.paid_amount ?? 0),
    balance_due: Number(raw.balance_due ?? Number(raw.total ?? 0) - Number(raw.paid_amount ?? 0)),
    paid_at:     raw.paid_at ?? null,
    client:   raw.clients ?? { id: '', company_name: '', contact_name: null, email: null, phone: null, address: null, gst_tax_id: null },
    projects: linkedProjects,
    items:    ((raw.invoice_items as InvoiceItemRow[]) ?? [])
                .sort((a, b) => ((a as unknown as { sort_order: number }).sort_order ?? 0) -
                                ((b as unknown as { sort_order: number }).sort_order ?? 0)),
  } as unknown as InvoiceWithDetails
}

// ─── RPC wrappers (all mutations through SECURITY DEFINER RPCs) ───────────────

export async function dbCreateInvoice(
  supabase: TypedClient,
  params: {
    org_id:         string
    client_id:      string
    project_ids:    string[]
    issue_date:     string
    due_date:       string | null
    currency:       string
    discount_type:  string
    discount_value: number
    tax_rate:       number
    notes:          string | null
    payment_terms:  string | null
    line_items:     Array<{ description: string; quantity: number; unit_price: number; project_id?: string | null }>
  }
): Promise<{ id: string; invoice_number: string }> {
  const { data, error } = await supabase.rpc('create_invoice', {
    p_org_id:         params.org_id,
    p_client_id:      params.client_id,
    p_project_ids:    params.project_ids,
    p_issue_date:     params.issue_date,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_due_date:       params.due_date as any,   // DB: DATE (nullable); generator emits string
    p_currency:       params.currency,
    p_discount_type:  params.discount_type,
    p_discount_value: params.discount_value,
    p_tax_rate:       params.tax_rate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_notes:          params.notes         as any,  // DB: nullable TEXT; generator emits string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_payment_terms:  params.payment_terms as any,  // DB: nullable TEXT; generator emits string
    p_line_items:     params.line_items,
  })
  if (error) throw error
  return data as { id: string; invoice_number: string }
}

export async function dbUpdateInvoice(
  supabase: TypedClient,
  params: {
    invoice_id:     string
    client_id:      string
    project_ids:    string[]
    issue_date:     string
    due_date:       string | null
    currency:       string
    discount_type:  string
    discount_value: number
    tax_rate:       number
    notes:          string | null
    payment_terms:  string | null
    line_items:     Array<{ description: string; quantity: number; unit_price: number; project_id?: string | null }>
  }
): Promise<{ id: string; total: number }> {
  const { data, error } = await supabase.rpc('update_invoice', {
    p_invoice_id:     params.invoice_id,
    p_client_id:      params.client_id,
    p_project_ids:    params.project_ids,
    p_issue_date:     params.issue_date,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_due_date:       params.due_date as any,   // DB: DATE (nullable); generator emits string
    p_currency:       params.currency,
    p_discount_type:  params.discount_type,
    p_discount_value: params.discount_value,
    p_tax_rate:       params.tax_rate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_notes:          params.notes         as any,  // DB: nullable TEXT; generator emits string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_payment_terms:  params.payment_terms as any,  // DB: nullable TEXT; generator emits string
    p_line_items:     params.line_items,
  })
  if (error) throw error
  return data as { id: string; total: number }
}

export async function dbTransitionInvoiceStatus(
  supabase: TypedClient,
  invoiceId: string,
  newStatus: Database['public']['Enums']['invoice_status']
): Promise<void> {
  const { error } = await supabase.rpc('transition_invoice_status', {
    p_invoice_id: invoiceId,
    p_new_status: newStatus,
  })
  if (error) throw error
}

// ─── Project options for invoice form (includes budget for snapshot pricing) ─

export async function dbGetProjectsByClient(
  supabase: TypedClient,
  organizationId: string,
  clientId: string
): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, budget')
    .eq('organization_id', organizationId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('name')

  if (error) throw error
  return (data ?? []).map((p) => ({
    id:     p.id,
    name:   p.name,
    budget: p.budget !== null ? Number(p.budget) : null,
  }))
}
