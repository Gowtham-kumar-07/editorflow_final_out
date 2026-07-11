import type { Database, InvoiceStatus } from '@/types/supabase'

export type { InvoiceStatus }

export type InvoiceRow     = Database['public']['Tables']['invoices']['Row']
export type InvoiceItemRow = Database['public']['Tables']['invoice_items']['Row']

export type DiscountType = 'fixed' | 'percent'

// ── Linked project (from invoice_projects join) ───────────────────────────────

export interface LinkedProject {
  id:   string
  name: string
}

// ── Full invoice with joined data (detail view) ───────────────────────────────

export interface InvoiceWithDetails {
  id:              string
  organization_id: string
  client_id:       string
  project_id:      string | null  // deprecated; use `projects` array going forward
  invoice_number:  string
  status:          InvoiceStatus
  issue_date:      string
  due_date:        string | null
  currency:        string
  subtotal:        number
  discount_type:   string
  discount_value:  number
  discount:        number
  tax_rate:        number
  tax:             number
  total:           number
  notes:           string | null
  payment_terms:   string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
  deleted_at:      string | null
  paid_amount: number
  balance_due: number
  paid_at:     string | null
  // Joined relations
  client: {
    id:           string
    company_name: string
    contact_name: string | null
    email:        string | null
    phone:        string | null
    address:      string | null
    gst_tax_id:   string | null
  }
  projects: LinkedProject[]   // from invoice_projects (replaces single `project`)
  items:    InvoiceItemRow[]
}

// ── Flat list item (list view) ────────────────────────────────────────────────

export interface InvoiceListItem {
  id:              string
  organization_id: string
  client_id:       string
  invoice_number:  string
  status:          InvoiceStatus
  issue_date:      string
  due_date:        string | null
  currency:        string
  total:           number
  created_at:      string
  // Joined
  client_name:   string
  project_names: string[]
}

// ── Project option for invoice form ─────────────────────────────────────────

export interface ProjectOption {
  id:     string
  name:   string
  budget: number | null
}

// ── Filters + pagination ──────────────────────────────────────────────────────

export type InvoiceSortField = 'invoice_number' | 'issue_date' | 'due_date' | 'total' | 'created_at'

export interface InvoiceFilters {
  search?:    string
  status?:    InvoiceStatus | 'all'
  clientId?:  string
  sortBy?:    InvoiceSortField
  sortOrder?: 'asc' | 'desc'
  page?:      number
  pageSize?:  number
}

export interface GetInvoicesResult {
  invoices:   InvoiceListItem[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

// ── Derived "overdue" display status ─────────────────────────────────────────

export function getDisplayStatus(
  status:  InvoiceStatus,
  dueDate: string | null
): InvoiceStatus {
  if (
    status === 'sent' &&
    dueDate &&
    new Date(dueDate) < new Date(new Date().toDateString())
  ) {
    return 'overdue'
  }
  return status
}
