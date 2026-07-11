export type IncomeStatus = 'pending' | 'paid'

export interface IncomeRecord {
  id:                    string
  organization_id:       string
  member_id:             string
  task_id:               string
  amount:                number
  currency:              string
  status:                IncomeStatus
  completed_at:          string
  paid_at:               string | null
  paid_by:               string | null
  payment_method:        string | null
  transaction_reference: string | null
  notes:                 string | null
  created_at:            string
  updated_at:            string
}

export interface IncomeListItem extends IncomeRecord {
  member_name:  string | null
  task_title:   string | null
  project_name: string | null
}

export interface IncomeFilters {
  memberId?:  string
  status?:    IncomeStatus | ''
  from?:      string
  to?:        string
  page?:      number
  pageSize?:  number
}

export interface GetIncomeResult {
  items:      IncomeListItem[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export interface IncomeSummary {
  pending_count:  number
  pending_amount: number
  paid_count:     number
  paid_amount:    number
  currency:       string
}

export interface MarkPaidFormValues {
  payment_date:           string
  payment_method:         string
  transaction_reference?: string
  notes?:                 string
}
