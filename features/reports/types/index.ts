export type { DatePreset, ReportDateRange } from '../utils/date-range'

export interface ReportParams {
  from: string
  to:   string
}

// ─── Overview ────────────────────────────────────────────────────────────────

export interface OverviewKpis {
  revenue_in_period:     number
  outstanding_balance:   number
  overdue_amount:        number
  invoices_sent:         number
  projects_completed:    number
  on_time_delivery_rate: number | null
}

export interface RevenueByCurrencyRow {
  currency: string
  total:    number
  count:    number
}

export interface ProjectStatusCount {
  status: string
  count:  number
}

export interface TopClientRow {
  client_id:   string
  client_name: string
  revenue:     number
  currency:    string
}

export interface OverviewReport {
  kpis:                OverviewKpis
  revenue_by_currency: RevenueByCurrencyRow[]
  project_status_dist: ProjectStatusCount[]
  top_clients:         TopClientRow[]
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface ReportPayment {
  id:             string
  amount:         number
  payment_date:   string
  payment_method: string | null
  invoice_id:     string
  invoice_number: string
  client_id:      string
  client_name:    string
  currency:       string
}

export interface PaymentMethodRow {
  method:   string
  amount:   number
  count:    number
  currency: string
}

export interface MonthlyTrendRow {
  month:    string // 'YYYY-MM'
  label:    string // 'Jan 2026'
  amount:   number
  currency: string
}

export interface RevenueReport {
  by_currency:   RevenueByCurrencyRow[]
  by_method:     PaymentMethodRow[]
  monthly_trend: MonthlyTrendRow[]
  payments:      ReportPayment[]
}

// ─── Receivables ─────────────────────────────────────────────────────────────

export interface AgingBucket {
  label:    string
  days_min: number
  days_max: number | null
  amount:   number
  count:    number
  currency: string
}

export interface OverdueInvoiceRow {
  id:             string
  invoice_number: string
  client_name:    string
  issue_date:     string
  due_date:       string
  balance_due:    number
  currency:       string
  days_overdue:   number
}

export interface ReceivablesCurrencySummary {
  currency:          string
  total_outstanding: number
  total_overdue:     number
  count:             number
}

export interface ReceivablesReport {
  summary_by_currency: ReceivablesCurrencySummary[]
  aging:               AgingBucket[]
  overdue_invoices:    OverdueInvoiceRow[]
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export interface ClientRevenueRow {
  client_id:      string
  client_name:    string
  invoiced_total: number
  paid_total:     number
  outstanding:    number
  currency:       string
  invoice_count:  number
}

export interface ClientRevenueReport {
  rows:       ClientRevenueRow[]
  currencies: string[]
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectDeliveryKpis {
  total:        number
  completed:    number
  in_progress:  number
  overdue:      number
  on_time_rate: number | null
}

export interface ProjectDeliveryRow {
  id:           string
  name:         string
  status:       string
  client_name:  string | null
  start_date:   string | null
  due_date:     string | null
  completed_at: string | null
  progress:     number
  on_time:      boolean | null
  is_overdue:   boolean
}

export interface ProjectDeliveryReport {
  kpis:     ProjectDeliveryKpis
  projects: ProjectDeliveryRow[]
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskPerformanceKpis {
  total:           number
  completed:       number
  overdue:         number
  completion_rate: number
}

export interface TaskPerformanceRow {
  id:            string
  title:         string
  status:        string
  assignee_name: string | null
  project_name:  string | null
  due_date:      string | null
  completed_at:  string | null
  is_overdue:    boolean
  priority:      string
}

export interface TaskPerformanceReport {
  kpis:  TaskPerformanceKpis
  tasks: TaskPerformanceRow[]
}

// ─── Team ────────────────────────────────────────────────────────────────────

export interface TeamMemberRow {
  user_id:      string
  name:         string
  email:        string | null
  completed:    number
  in_review:    number
  in_progress:  number
  overdue:      number
  total_active: number
}

export interface TeamPerformanceReport {
  members: TeamMemberRow[]
}

// ─── Bottlenecks ─────────────────────────────────────────────────────────────

export interface BottleneckTaskRow {
  id:            string
  title:         string
  status:        string
  project_name:  string | null
  assignee_name: string | null
  due_date:      string | null
  is_overdue:    boolean
  days_stale:    number
  priority:      string
}

export interface OverdueProjectRow {
  id:            string
  name:          string
  client_name:   string | null
  due_date:      string
  days_overdue:  number
  status:        string
  progress:      number
  overdue_tasks: number
}

export interface BottlenecksReport {
  stuck_tasks:      BottleneckTaskRow[]
  overdue_projects: OverdueProjectRow[]
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export interface PayrollMemberRow {
  member_id:      string
  member_name:    string | null
  pending_count:  number
  pending_amount: number
  paid_count:     number
  paid_amount:    number
  currency:       string
}

export interface PayrollReport {
  rows:     PayrollMemberRow[]
  currency: string
  totals: {
    pending_count:  number
    pending_amount: number
    paid_count:     number
    paid_amount:    number
  }
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

export type ReportTab =
  | 'overview'
  | 'revenue'
  | 'receivables'
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'team'
  | 'bottlenecks'
  | 'payroll'

export interface ReportTabDef {
  id:    ReportTab
  label: string
}

export const ADMIN_TABS: ReportTabDef[] = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'revenue',      label: 'Revenue'      },
  { id: 'receivables',  label: 'Receivables'  },
  { id: 'clients',      label: 'Clients'      },
  { id: 'projects',     label: 'Projects'     },
  { id: 'tasks',        label: 'Tasks'        },
  { id: 'team',         label: 'Team'         },
  { id: 'bottlenecks',  label: 'Bottlenecks'  },
  { id: 'payroll',      label: 'Payroll'      },
]

export const PM_TABS: ReportTabDef[] = [
  { id: 'projects',    label: 'Projects'    },
  { id: 'tasks',       label: 'Tasks'       },
  { id: 'team',        label: 'Team'        },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'payroll',     label: 'Payroll'     },
]
