import type { Database } from '@/types/supabase'

export type PaymentRow = Database['public']['Tables']['payments']['Row']

export type PaymentStatus = 'completed' | 'voided'
export type PaymentMethod = 'bank_transfer' | 'upi' | 'cash' | 'card' | 'cheque' | 'other'

export interface PaymentRecord {
  id:                    string
  invoice_id:            string
  organization_id:       string
  recorded_by:           string | null
  amount:                number
  payment_date:          string
  payment_method:        string
  transaction_reference: string | null
  notes:                 string | null
  status:                string
  voided_at:             string | null
  voided_by:             string | null
  void_reason:           string | null
  created_at:            string
  updated_at:            string
  // FX snapshot — stored permanently at payment time; never reconverted
  transaction_currency:  string
  base_currency:         string
  fx_rate:               number
  base_amount:           number
  fx_rate_source:        string   // 'live' | 'manual' | 'fallback_1'
  fx_rate_date:          string | null
}

// Enriched row for ledger list view
export interface PaymentListItem extends PaymentRecord {
  invoice_number:   string
  invoice_currency: string
  client_id:        string
  client_name:      string
  recorded_by_name: string | null
}

export interface PaymentFilters {
  search?:   string
  status?:   'completed' | 'voided' | 'all'
  method?:   PaymentMethod | 'all'
  dateFrom?: string
  dateTo?:   string
  page?:     number
  pageSize?: number
}

export interface GetPaymentsResult {
  payments:    PaymentListItem[]
  total:       number
  page:        number
  pageSize:    number
  totalPages:  number
}

export interface PaymentSummaryMetrics {
  total_collected:      number
  collected_this_month: number
  outstanding_balance:  number
  payments_this_month:  number
  base_currency:        string   // currency for total_collected and collected_this_month
}

export interface PayableInvoiceOption {
  id:             string
  invoice_number: string
  balance_due:    number
  currency:       string
}

export interface ClientOption {
  id:           string
  company_name: string
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  upi:           'UPI',
  cash:          'Cash',
  card:          'Card',
  cheque:        'Cheque',
  other:         'Other',
}
