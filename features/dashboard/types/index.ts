import type { OrgRole, ProjectStatus, TaskStatus, ActivityType } from '@/types/supabase'

// ─── Re-export role alias ──────────────────────────────────────────────────────
export type DashboardRole = OrgRole

// ─── Shared building blocks ────────────────────────────────────────────────────

export interface DashboardKpi {
  label:     string
  value:     number
  change?:   string
  href?:     string
}

export interface RevenueTrendMonth {
  month:  string   // 'Jan 2025'
  amount: number
}

export interface ProjectStatusCount {
  status: ProjectStatus
  count:  number
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export interface DashboardActivityItem {
  id:            string
  user_id:       string | null
  user_name:     string | null
  activity_type: ActivityType
  entity_type:   string
  entity_id:     string
  entity_title:  string | null
  action:        string | null  // from metadata.action
  created_at:    string
}

// ─── Financial widgets ─────────────────────────────────────────────────────────

export interface FinancialAttentionItem {
  id:             string
  invoice_number: string
  client_name:    string
  due_date:       string | null
  balance_due:    number
  currency:       string
  status:         string
}

export interface RecentPaymentItem {
  id:              string
  invoice_id:      string
  invoice_number:  string
  client_name:     string
  amount:          number
  currency:        string
  payment_date:    string
  payment_method:  string
  base_amount:     number
  base_currency:   string
}

// ─── Task widgets ──────────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  id:            string
  title:         string
  project_id:    string
  project_name:  string
  assignee_name: string | null
  updated_at:    string
  due_date:      string | null
}

export interface UpcomingDeadlineItem {
  id:            string
  title:         string
  project_id:    string
  project_name:  string
  assignee_name: string | null
  due_date:      string
  status:        TaskStatus
  is_overdue:    boolean
}

export interface MyTaskItem {
  id:           string
  title:        string
  project_id:   string
  project_name: string
  status:       TaskStatus
  priority:     string
  due_date:     string | null
  is_overdue:   boolean
}

// ─── Project widgets ───────────────────────────────────────────────────────────

export interface ProjectHealthItem {
  id:           string
  name:         string
  status:       ProjectStatus
  progress:     number
  open_tasks:   number
  review_tasks: number
  overdue_tasks: number
  client_name:  string | null
}

export interface AssignedProjectItem {
  id:         string
  name:       string
  status:     ProjectStatus
  progress:   number
  my_tasks:   number
}

// ─── Team workload ─────────────────────────────────────────────────────────────

export interface TeamWorkloadMember {
  user_id:        string
  name:           string
  specialization: string | null
  active_tasks:   number
  in_review:      number
  overdue:        number
}

// ─── Role-aware dashboard payloads ────────────────────────────────────────────

export interface AdminDashboardData {
  role:                'owner' | 'admin'
  kpis: {
    active_projects:     number
    tasks_in_review:     number
    revenue_this_month:  number
    outstanding_balance: number
    overdue_invoices:    number
    active_members:      number
    // Currency these financial KPIs are expressed in (org's default_currency)
    revenue_currency:    string
    // Payroll KPIs
    pending_payroll:     number
    paid_this_month_payroll: number
    payroll_currency:    string
  }
  revenue_trend:        RevenueTrendMonth[]
  project_status_dist:  ProjectStatusCount[]
  financial_attention:  FinancialAttentionItem[]
  recent_payments:      RecentPaymentItem[]
  review_queue:         ReviewQueueItem[]
  recent_activity:      DashboardActivityItem[]
}

export interface PmDashboardData {
  role:            'project_manager'
  kpis: {
    active_projects:  number
    tasks_in_progress: number
    tasks_in_review:  number
    overdue_tasks:    number
    active_members:   number
    on_hold_projects: number
  }
  review_queue:     ReviewQueueItem[]
  team_workload:    TeamWorkloadMember[]
  upcoming:         UpcomingDeadlineItem[]
  project_health:   ProjectHealthItem[]
  recent_activity:  DashboardActivityItem[]
}

export interface MemberIncomeKpis {
  this_month_income: number
  pending_income:    number
  paid_income:       number
  completed_tasks:   number
  currency:          string
}

export interface MemberDashboardData {
  role:           'member'
  kpis: {
    active_tasks:    number
    in_progress:     number
    in_review:       number
    overdue:         number
    due_this_week:   number
  }
  income_kpis:       MemberIncomeKpis
  my_tasks:          MyTaskItem[]
  review_status:     ReviewQueueItem[]
  upcoming:          UpcomingDeadlineItem[]
  assigned_projects: AssignedProjectItem[]
  recent_activity:   DashboardActivityItem[]
}

export type DashboardData = AdminDashboardData | PmDashboardData | MemberDashboardData
