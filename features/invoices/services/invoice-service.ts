import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InvoiceStatus } from '@/types/supabase'
import type { InvoiceFilters, GetInvoicesResult, InvoiceWithDetails, ProjectOption } from '../types'
import type { InvoiceFormValues } from '../schema'
import {
  dbFindInvoices,
  dbFindInvoiceById,
  dbCreateInvoice,
  dbUpdateInvoice,
  dbTransitionInvoiceStatus,
  dbGetProjectsByClient,
} from '../repository/invoice.repository'

type TypedClient = SupabaseClient<Database>

export const INVOICE_PAGE_SIZE = 20

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchInvoices(
  supabase: TypedClient,
  organizationId: string,
  filters: InvoiceFilters = {}
): Promise<GetInvoicesResult> {
  const pageSize = filters.pageSize ?? INVOICE_PAGE_SIZE
  const page     = filters.page     ?? 1
  const { rows, count } = await dbFindInvoices(supabase, organizationId, {
    ...filters,
    pageSize,
    page,
  })
  return {
    invoices:   rows,
    total:      count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  }
}

export async function fetchInvoiceById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<InvoiceWithDetails | null> {
  return dbFindInvoiceById(supabase, id, organizationId)
}

export async function fetchProjectsByClient(
  supabase: TypedClient,
  organizationId: string,
  clientId: string
): Promise<ProjectOption[]> {
  return dbGetProjectsByClient(supabase, organizationId, clientId)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function formToRpcLineItems(values: InvoiceFormValues) {
  return values.line_items.map(({ description, quantity, unit_price, project_id }) => ({
    description,
    quantity,
    unit_price,
    project_id: project_id || null,
  }))
}

export async function createInvoiceService(
  supabase: TypedClient,
  organizationId: string,
  values: InvoiceFormValues
): Promise<{ id: string; invoice_number: string }> {
  return dbCreateInvoice(supabase, {
    org_id:         organizationId,
    client_id:      values.client_id,
    project_ids:    values.project_ids.filter(Boolean),
    issue_date:     values.issue_date,
    due_date:       values.due_date?.trim()     || null,
    currency:       values.currency,
    discount_type:  values.discount_type,
    discount_value: values.discount_value,
    tax_rate:       values.tax_rate,
    notes:          values.notes?.trim()         || null,
    payment_terms:  values.payment_terms?.trim() || null,
    line_items:     formToRpcLineItems(values),
  })
}

export async function updateInvoiceService(
  supabase: TypedClient,
  invoiceId: string,
  values: InvoiceFormValues
): Promise<{ id: string; total: number }> {
  return dbUpdateInvoice(supabase, {
    invoice_id:     invoiceId,
    client_id:      values.client_id,
    project_ids:    values.project_ids.filter(Boolean),
    issue_date:     values.issue_date,
    due_date:       values.due_date?.trim()     || null,
    currency:       values.currency,
    discount_type:  values.discount_type,
    discount_value: values.discount_value,
    tax_rate:       values.tax_rate,
    notes:          values.notes?.trim()         || null,
    payment_terms:  values.payment_terms?.trim() || null,
    line_items:     formToRpcLineItems(values),
  })
}

export async function transitionInvoiceStatusService(
  supabase: TypedClient,
  invoiceId: string,
  newStatus: InvoiceStatus
): Promise<void> {
  return dbTransitionInvoiceStatus(supabase, invoiceId, newStatus)
}
