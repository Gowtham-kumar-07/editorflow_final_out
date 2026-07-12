import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  OverviewReport,
  OverviewKpis,
  RevenueByCurrencyRow,
  ProjectStatusCount,
  TopClientRow,
  RevenueReport,
  ReportPayment,
  PaymentMethodRow,
  MonthlyTrendRow,
  ReceivablesReport,
  ReceivablesCurrencySummary,
  AgingBucket,
  OverdueInvoiceRow,
  ClientRevenueReport,
  ClientRevenueRow,
  ProjectDeliveryReport,
  ProjectDeliveryKpis,
  ProjectDeliveryRow,
  TaskPerformanceReport,
  TaskPerformanceKpis,
  TaskPerformanceRow,
  TeamPerformanceReport,
  TeamMemberRow,
  BottlenecksReport,
  BottleneckTaskRow,
  OverdueProjectRow,
  PayrollReport,
  PayrollMemberRow,
} from '../types'

type Supabase = SupabaseClient<Database>

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ACTIVE_PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'review'] as const
const TODAY = () => new Date().toISOString().slice(0, 10)

function monthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  )
}

// ─── Overview report ──────────────────────────────────────────────────────────

export async function dbGetOverviewReport(
  supabase:    Supabase,
  orgId:       string,
  from:        string,
  to:          string,
  orgCurrency: string,
): Promise<OverviewReport> {
  const today = TODAY()

  const [
    { data: paymentsRaw },
    { data: invoicesRaw },
    { data: projectsRaw },
    { data: clientsRaw },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, base_amount, invoice_id')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .gte('payment_date', from)
      .lte('payment_date', to)
      .is('deleted_at', null),

    supabase
      .from('invoices')
      .select('id, total, balance_due, currency, status, due_date, issue_date, client_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('projects')
      .select('id, status, due_date, completed_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const payments  = paymentsRaw  ?? []
  const invoices  = invoicesRaw  ?? []
  const projects  = projectsRaw  ?? []
  const clients   = clientsRaw   ?? []

  // Need invoices to get currency for payments in period
  const invoiceMap = new Map(invoices.map(i => [i.id, i]))
  const clientMap  = new Map(clients.map(c => [c.id, c.company_name]))

  // Revenue by currency (payments in period) — use invoice currency for grouping
  // but base_amount for the total so cross-currency payments don't double-count
  const revMap = new Map<string, { total: number; count: number }>()
  for (const p of payments) {
    const inv = invoiceMap.get(p.invoice_id)
    if (!inv) continue
    const cur = inv.currency.toUpperCase()
    const g = revMap.get(cur) ?? { total: 0, count: 0 }
    // Use the original transaction amount for per-currency breakdown (correct per currency)
    g.total += p.amount
    g.count += 1
    revMap.set(cur, g)
  }
  const revenue_by_currency: RevenueByCurrencyRow[] = Array.from(revMap.entries())
    .map(([currency, g]) => ({ currency, total: g.total, count: g.count }))
    .sort((a, b) => b.total - a.total)

  // Outstanding + overdue
  const openStatuses = new Set(['sent', 'overdue', 'partial'])
  let outstanding_balance = 0
  let overdue_amount      = 0
  for (const inv of invoices) {
    if (!openStatuses.has(inv.status)) continue
    outstanding_balance += inv.balance_due ?? 0
    if (inv.due_date && inv.due_date < today && (inv.balance_due ?? 0) > 0) {
      overdue_amount += inv.balance_due ?? 0
    }
  }

  // Invoices sent in period
  const invoices_sent = invoices.filter(
    i => i.issue_date >= from && i.issue_date <= to
  ).length

  // Project status distribution
  const statusCount = new Map<string, number>()
  for (const p of projects) {
    statusCount.set(p.status, (statusCount.get(p.status) ?? 0) + 1)
  }
  const project_status_dist: ProjectStatusCount[] = Array.from(statusCount.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // On-time delivery rate (completed projects with due_date)
  const completedWithDue = projects.filter(
    p => p.status === 'completed' && p.completed_at && p.due_date
  )
  const onTime = completedWithDue.filter(p => p.completed_at! <= p.due_date!)
  const on_time_delivery_rate = completedWithDue.length > 0
    ? Math.round((onTime.length / completedWithDue.length) * 100)
    : null

  const projects_completed = projects.filter(p => p.status === 'completed').length

  // Revenue in period — sum of base_amount so FX-adjusted across all invoice currencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revenue_in_period = payments.reduce((s, p: any) => s + Number(p.base_amount ?? p.amount), 0)

  const kpis: OverviewKpis = {
    revenue_in_period,
    outstanding_balance,
    overdue_amount,
    invoices_sent,
    projects_completed,
    on_time_delivery_rate,
  }

  // Top clients by paid revenue in period (per currency)
  const clientRevMap = new Map<string, Map<string, number>>()
  for (const p of payments) {
    const inv = invoiceMap.get(p.invoice_id)
    if (!inv || !inv.client_id) continue
    const key = `${inv.client_id}::${inv.currency.toUpperCase()}`
    const cur = clientRevMap.get(key) ?? new Map()
    clientRevMap.set(key, cur)
    const prev = cur.get('amount') ?? 0
    cur.set('amount', prev + p.amount)
    cur.set('client_id', inv.client_id as unknown as number)
    cur.set('currency', inv.currency.toUpperCase() as unknown as number)
  }

  // Rebuild top clients cleanly
  const clientRevAgg = new Map<string, { client_id: string; currency: string; revenue: number }>()
  for (const p of payments) {
    const inv = invoiceMap.get(p.invoice_id)
    if (!inv || !inv.client_id) continue
    const key = `${inv.client_id}||${inv.currency.toUpperCase()}`
    const entry = clientRevAgg.get(key) ?? { client_id: inv.client_id, currency: inv.currency.toUpperCase(), revenue: 0 }
    entry.revenue += p.amount
    clientRevAgg.set(key, entry)
  }

  const top_clients: TopClientRow[] = Array.from(clientRevAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(e => ({
      client_id:   e.client_id,
      client_name: clientMap.get(e.client_id) ?? 'Unknown Client',
      revenue:     e.revenue,
      currency:    e.currency,
    }))

  return { kpis, revenue_by_currency, project_status_dist, top_clients, org_currency: orgCurrency }
}

// ─── Revenue report ───────────────────────────────────────────────────────────

export async function dbGetRevenueReport(
  supabase: Supabase,
  orgId:    string,
  from:     string,
  to:       string,
): Promise<RevenueReport> {
  const [
    { data: paymentsRaw },
    { data: invoicesRaw },
    { data: clientsRaw },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, base_amount, payment_date, payment_method, invoice_id')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .gte('payment_date', from)
      .lte('payment_date', to)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false }),

    supabase
      .from('invoices')
      .select('id, invoice_number, currency, client_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const payments = paymentsRaw ?? []
  const invoices = invoicesRaw ?? []
  const clients  = clientsRaw  ?? []

  const invoiceMap = new Map(invoices.map(i => [i.id, i]))
  const clientMap  = new Map(clients.map(c => [c.id, c.company_name]))

  // Build enriched payment list
  const enrichedPayments: ReportPayment[] = payments.map(p => {
    const inv = invoiceMap.get(p.invoice_id)
    return {
      id:             p.id,
      amount:         p.amount,
      payment_date:   p.payment_date,
      payment_method: p.payment_method,
      invoice_id:     p.invoice_id,
      invoice_number: inv?.invoice_number ?? p.invoice_id,
      client_id:      inv?.client_id ?? '',
      client_name:    clientMap.get(inv?.client_id ?? '') ?? 'Unknown Client',
      currency:       inv?.currency?.toUpperCase() ?? 'USD',
    }
  })

  // By currency
  const curMap = new Map<string, { total: number; count: number }>()
  for (const p of enrichedPayments) {
    const g = curMap.get(p.currency) ?? { total: 0, count: 0 }
    g.total += p.amount
    g.count += 1
    curMap.set(p.currency, g)
  }
  const by_currency: RevenueByCurrencyRow[] = Array.from(curMap.entries())
    .map(([currency, g]) => ({ currency, total: g.total, count: g.count }))
    .sort((a, b) => b.total - a.total)

  // By payment method (per currency)
  const methodMap = new Map<string, { amount: number; count: number; currency: string }>()
  for (const p of enrichedPayments) {
    const method = p.payment_method ?? 'Other'
    const key = `${method}||${p.currency}`
    const g = methodMap.get(key) ?? { amount: 0, count: 0, currency: p.currency }
    g.amount += p.amount
    g.count  += 1
    methodMap.set(key, g)
  }
  const by_method: PaymentMethodRow[] = Array.from(methodMap.entries())
    .map(([key, g]) => ({
      method:   key.split('||')[0],
      amount:   g.amount,
      count:    g.count,
      currency: g.currency,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Monthly trend
  const trendMap = new Map<string, { amount: number; currency: string }>()
  for (const p of enrichedPayments) {
    const month = p.payment_date.slice(0, 7) // 'YYYY-MM'
    const key = `${month}||${p.currency}`
    const g = trendMap.get(key) ?? { amount: 0, currency: p.currency }
    g.amount += p.amount
    trendMap.set(key, g)
  }
  const monthly_trend: MonthlyTrendRow[] = Array.from(trendMap.entries())
    .map(([key, g]) => ({
      month:    key.split('||')[0],
      label:    monthLabel(key.split('||')[0]),
      amount:   g.amount,
      currency: g.currency,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return { by_currency, by_method, monthly_trend, payments: enrichedPayments }
}

// ─── Receivables report ───────────────────────────────────────────────────────

export async function dbGetReceivablesReport(
  supabase: Supabase,
  orgId:    string,
): Promise<ReceivablesReport> {
  const today = TODAY()

  const [{ data: invoicesRaw }, { data: clientsRaw }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total, balance_due, currency, status, issue_date, due_date, client_id')
      .eq('organization_id', orgId)
      .in('status', ['sent', 'partial', 'overdue'])
      .is('deleted_at', null)
      .order('due_date', { ascending: true }),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const invoices = invoicesRaw ?? []
  const clients  = clientsRaw  ?? []
  const clientMap = new Map(clients.map(c => [c.id, c.company_name]))

  // Summary per currency
  const summaryMap = new Map<string, { outstanding: number; overdue: number; count: number }>()
  for (const inv of invoices) {
    const cur = inv.currency.toUpperCase()
    const g = summaryMap.get(cur) ?? { outstanding: 0, overdue: 0, count: 0 }
    g.outstanding += inv.balance_due ?? 0
    g.count       += 1
    if (inv.due_date && inv.due_date < today && (inv.balance_due ?? 0) > 0) {
      g.overdue += inv.balance_due ?? 0
    }
    summaryMap.set(cur, g)
  }
  const summary_by_currency: ReceivablesCurrencySummary[] = Array.from(summaryMap.entries())
    .map(([currency, g]) => ({
      currency,
      total_outstanding: g.outstanding,
      total_overdue:     g.overdue,
      count:             g.count,
    }))
    .sort((a, b) => b.total_outstanding - a.total_outstanding)

  // Aging buckets (per currency for overdue invoices)
  const AGING_BUCKETS = [
    { label: 'Current',     days_min: -Infinity, days_max: 0       },
    { label: '1–30 days',   days_min: 1,         days_max: 30      },
    { label: '31–60 days',  days_min: 31,        days_max: 60      },
    { label: '61–90 days',  days_min: 61,        days_max: 90      },
    { label: '90+ days',    days_min: 91,        days_max: Infinity },
  ]

  const agingMap = new Map<string, { amount: number; count: number }>()
  for (const inv of invoices) {
    if (!inv.due_date) continue
    const cur = inv.currency.toUpperCase()
    const daysOverdue = daysBetween(inv.due_date, today)
    const bucket = AGING_BUCKETS.find(b => daysOverdue >= b.days_min && daysOverdue <= b.days_max)
    if (!bucket) continue
    const key = `${bucket.label}||${cur}`
    const g = agingMap.get(key) ?? { amount: 0, count: 0 }
    g.amount += inv.balance_due ?? 0
    g.count  += 1
    agingMap.set(key, g)
  }

  const aging: AgingBucket[] = AGING_BUCKETS.flatMap(b => {
    const currencies = new Set<string>()
    for (const [key] of agingMap.entries()) {
      if (key.startsWith(`${b.label}||`)) currencies.add(key.split('||')[1])
    }
    return Array.from(currencies).map(cur => {
      const g = agingMap.get(`${b.label}||${cur}`) ?? { amount: 0, count: 0 }
      return {
        label:    b.label,
        days_min: b.days_min === -Infinity ? 0 : b.days_min,
        days_max: b.days_max === Infinity ? null : b.days_max,
        amount:   g.amount,
        count:    g.count,
        currency: cur,
      }
    })
  })

  // Overdue invoices list
  const overdue_invoices: OverdueInvoiceRow[] = invoices
    .filter(inv => inv.due_date && inv.due_date < today && (inv.balance_due ?? 0) > 0)
    .map(inv => ({
      id:             inv.id,
      invoice_number: inv.invoice_number,
      client_name:    clientMap.get(inv.client_id) ?? 'Unknown Client',
      issue_date:     inv.issue_date,
      due_date:       inv.due_date!,
      balance_due:    inv.balance_due ?? 0,
      currency:       inv.currency.toUpperCase(),
      days_overdue:   daysBetween(inv.due_date!, today),
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue)

  return { summary_by_currency, aging, overdue_invoices }
}

// ─── Client revenue report ────────────────────────────────────────────────────

export async function dbGetClientRevenueReport(
  supabase: Supabase,
  orgId:    string,
  from:     string,
  to:       string,
): Promise<ClientRevenueReport> {
  const [
    { data: invoicesRaw },
    { data: paymentsRaw },
    { data: clientsRaw },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, total, balance_due, paid_amount, currency, status, client_id')
      .eq('organization_id', orgId)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .is('deleted_at', null),

    supabase
      .from('payments')
      .select('id, amount, invoice_id')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .gte('payment_date', from)
      .lte('payment_date', to)
      .is('deleted_at', null),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const invoices = invoicesRaw ?? []
  const payments = paymentsRaw ?? []
  const clients  = clientsRaw  ?? []

  const clientMap = new Map(clients.map(c => [c.id, c.company_name]))

  // Sum payments per invoice
  const paidByInvoice = new Map<string, number>()
  for (const p of payments) {
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + p.amount)
  }

  // Aggregate per client + currency
  const rowMap = new Map<string, ClientRevenueRow>()
  for (const inv of invoices) {
    if (!inv.client_id) continue
    const cur = inv.currency.toUpperCase()
    const key = `${inv.client_id}||${cur}`
    const existing = rowMap.get(key) ?? {
      client_id:      inv.client_id,
      client_name:    clientMap.get(inv.client_id) ?? 'Unknown Client',
      invoiced_total: 0,
      paid_total:     0,
      outstanding:    0,
      currency:       cur,
      invoice_count:  0,
    }
    existing.invoiced_total += inv.total
    existing.paid_total     += paidByInvoice.get(inv.id) ?? 0
    existing.outstanding    += inv.balance_due ?? 0
    existing.invoice_count  += 1
    rowMap.set(key, existing)
  }

  const rows: ClientRevenueRow[] = Array.from(rowMap.values())
    .sort((a, b) => b.invoiced_total - a.invoiced_total)

  const currencies = Array.from(new Set(rows.map(r => r.currency))).sort()

  return { rows, currencies }
}

// ─── Project delivery report ──────────────────────────────────────────────────

export async function dbGetProjectDeliveryReport(
  supabase: Supabase,
  orgId:    string,
  from:     string,
  to:       string,
): Promise<ProjectDeliveryReport> {
  const today = TODAY()

  const [{ data: projectsRaw }, { data: clientsRaw }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, client_id, start_date, due_date, completed_at, progress')
      .eq('organization_id', orgId)
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const projects = projectsRaw ?? []
  const clients  = clientsRaw  ?? []
  const clientMap = new Map(clients.map(c => [c.id, c.company_name]))

  const ACTIVE = new Set(ACTIVE_PROJECT_STATUSES as readonly string[])

  const projectRows: ProjectDeliveryRow[] = projects.map(p => {
    const is_overdue = !!(
      p.due_date &&
      p.due_date < today &&
      ACTIVE.has(p.status)
    )
    const on_time = p.completed_at && p.due_date
      ? p.completed_at <= p.due_date
      : null
    return {
      id:           p.id,
      name:         p.name,
      status:       p.status,
      client_name:  clientMap.get(p.client_id) ?? null,
      start_date:   p.start_date,
      due_date:     p.due_date,
      completed_at: p.completed_at,
      progress:     p.progress,
      on_time,
      is_overdue,
    }
  })

  const total       = projectRows.length
  const completed   = projectRows.filter(p => p.status === 'completed').length
  const in_progress = projectRows.filter(p => ['active', 'on_hold', 'review'].includes(p.status)).length
  const overdue     = projectRows.filter(p => p.is_overdue).length

  const completedWithDue = projectRows.filter(p => p.on_time !== null)
  const on_time_rate = completedWithDue.length > 0
    ? Math.round((completedWithDue.filter(p => p.on_time).length / completedWithDue.length) * 100)
    : null

  const kpis: ProjectDeliveryKpis = { total, completed, in_progress, overdue, on_time_rate }

  return { kpis, projects: projectRows }
}

// ─── Task performance report ──────────────────────────────────────────────────

export async function dbGetTaskPerformanceReport(
  supabase: Supabase,
  orgId:    string,
  from:     string,
  to:       string,
): Promise<TaskPerformanceReport> {
  const today = TODAY()

  const [{ data: tasksRaw }, { data: membersRaw }, { data: projectsRaw }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, assigned_to, project_id, due_date, completed_at, priority')
      .eq('organization_id', orgId)
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('organization_memberships')
      .select('user_id, profiles(id, full_name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const tasks    = tasksRaw    ?? []
  const members  = membersRaw  ?? []
  const projects = projectsRaw ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = new Map((members as any[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return [m.user_id, prof?.full_name ?? null] as [string, string | null]
  }))
  const projectMap = new Map(projects.map(p => [p.id, p.name]))

  const OPEN_STATUSES = new Set(['todo', 'in_progress', 'blocked'])

  const taskRows: TaskPerformanceRow[] = tasks.map(t => ({
    id:            t.id,
    title:         t.title,
    status:        t.status,
    assignee_name: t.assigned_to ? (profileMap.get(t.assigned_to) ?? null) : null,
    project_name:  projectMap.get(t.project_id) ?? null,
    due_date:      t.due_date,
    completed_at:  t.completed_at,
    is_overdue:    !!(t.due_date && t.due_date < today && OPEN_STATUSES.has(t.status)),
    priority:      t.priority,
  }))

  const total       = taskRows.length
  const completed   = taskRows.filter(t => t.status === 'completed').length
  const overdue     = taskRows.filter(t => t.is_overdue).length
  const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0

  const kpis: TaskPerformanceKpis = { total, completed, overdue, completion_rate }

  return { kpis, tasks: taskRows }
}

// ─── Team performance report ──────────────────────────────────────────────────

export async function dbGetTeamPerformanceReport(
  supabase: Supabase,
  orgId:    string,
  from:     string,
  to:       string,
): Promise<TeamPerformanceReport> {
  const today = TODAY()

  const [{ data: membersRaw }, { data: tasksRaw }] = await Promise.all([
    supabase
      .from('organization_memberships')
      .select('user_id, profiles(full_name, email)')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('tasks')
      .select('id, assigned_to, status, due_date')
      .eq('organization_id', orgId)
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59')
      .is('deleted_at', null),
  ])

  const members = membersRaw ?? []
  const tasks   = tasksRaw   ?? []

  const OPEN_STATUSES = new Set(['todo', 'in_progress', 'blocked'])

  // Aggregate tasks per assignee
  const taskMap = new Map<string, {
    completed: number; in_review: number; in_progress: number; overdue: number; total_active: number
  }>()

  for (const t of tasks) {
    if (!t.assigned_to) continue
    const g = taskMap.get(t.assigned_to) ?? {
      completed: 0, in_review: 0, in_progress: 0, overdue: 0, total_active: 0
    }
    if (t.status === 'completed') {
      g.completed += 1
    } else if (t.status === 'review') {
      g.in_review  += 1
      g.total_active += 1
    } else if (t.status === 'in_progress') {
      g.in_progress  += 1
      g.total_active += 1
    } else if (OPEN_STATUSES.has(t.status)) {
      g.total_active += 1
    }
    if (t.due_date && t.due_date < today && OPEN_STATUSES.has(t.status)) {
      g.overdue += 1
    }
    taskMap.set(t.assigned_to, g)
  }

  const memberRows: TeamMemberRow[] = members
    .map(m => {
      const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      const stats = taskMap.get(m.user_id) ?? {
        completed: 0, in_review: 0, in_progress: 0, overdue: 0, total_active: 0
      }
      return {
        user_id:      m.user_id,
        name:         profileData?.full_name ?? 'Unknown',
        email:        profileData?.email ?? null,
        ...stats,
      }
    })
    .sort((a, b) => b.completed - a.completed)

  return { members: memberRows }
}

// ─── Bottlenecks report ───────────────────────────────────────────────────────

export async function dbGetBottlenecksReport(
  supabase: Supabase,
  orgId:    string,
): Promise<BottlenecksReport> {
  const today = TODAY()
  const staleThresholdMs = 7 * 24 * 60 * 60 * 1000

  const [
    { data: tasksRaw },
    { data: membersRaw },
    { data: projectsRaw },
    { data: clientsRaw },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, assigned_to, project_id, due_date, updated_at, priority')
      .eq('organization_id', orgId)
      .in('status', ['todo', 'in_progress', 'blocked', 'review'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: true }), // oldest first

    supabase
      .from('organization_memberships')
      .select('user_id, profiles(id, full_name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('projects')
      .select('id, name, status, due_date, progress, client_id')
      .eq('organization_id', orgId)
      .in('status', Array.from(ACTIVE_PROJECT_STATUSES))
      .is('deleted_at', null),

    supabase
      .from('clients')
      .select('id, company_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null),
  ])

  const tasks    = tasksRaw    ?? []
  const members  = membersRaw  ?? []
  const projects = projectsRaw ?? []
  const clients  = clientsRaw  ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = new Map((members as any[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return [m.user_id, prof?.full_name ?? null] as [string, string | null]
  }))
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const clientMap  = new Map(clients.map(c => [c.id, c.company_name]))

  const OPEN_STATUSES = new Set(['todo', 'in_progress', 'blocked'])
  const now = Date.now()

  // Stuck tasks: not updated in 7+ days
  const stuck_tasks: BottleneckTaskRow[] = tasks
    .filter(t => {
      const age = now - new Date(t.updated_at).getTime()
      return age >= staleThresholdMs
    })
    .map(t => {
      const days_stale = Math.floor(
        (now - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      const proj = projectMap.get(t.project_id)
      return {
        id:            t.id,
        title:         t.title,
        status:        t.status,
        project_name:  proj?.name ?? null,
        assignee_name: t.assigned_to ? (profileMap.get(t.assigned_to) ?? null) : null,
        due_date:      t.due_date,
        is_overdue:    !!(t.due_date && t.due_date < today && OPEN_STATUSES.has(t.status)),
        days_stale,
        priority:      t.priority,
      }
    })
    .sort((a, b) => b.days_stale - a.days_stale)
    .slice(0, 50)

  // Overdue projects: due_date < today and still active
  // Count overdue tasks per project
  const overdueTaskCountMap = new Map<string, number>()
  for (const t of tasks) {
    if (t.due_date && t.due_date < today && OPEN_STATUSES.has(t.status)) {
      overdueTaskCountMap.set(t.project_id, (overdueTaskCountMap.get(t.project_id) ?? 0) + 1)
    }
  }

  const overdue_projects: OverdueProjectRow[] = projects
    .filter(p => p.due_date && p.due_date < today)
    .map(p => ({
      id:            p.id,
      name:          p.name,
      client_name:   clientMap.get(p.client_id) ?? null,
      due_date:      p.due_date!,
      days_overdue:  daysBetween(p.due_date!, today),
      status:        p.status,
      progress:      p.progress,
      overdue_tasks: overdueTaskCountMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue)

  return { stuck_tasks, overdue_projects }
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export async function dbGetPayrollReport(
  supabase: Supabase,
  orgId:    string
): Promise<PayrollReport> {
  const { data: incomeRows } = await supabase
    .from('member_income')
    .select('member_id, amount, currency, status, original_currency, converted_amount')
    .eq('organization_id', orgId)

  const rows = incomeRows ?? []
  if (rows.length === 0) {
    return { rows: [], currency: 'USD', totals: { pending_count: 0, pending_amount: 0, paid_count: 0, paid_amount: 0 } }
  }

  // Fetch profiles for org members
  const { data: members } = await supabase
    .from('organization_memberships')
    .select('user_id, profiles(id, full_name)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = new Map((members ?? []).map((m: any) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return [m.user_id, prof?.full_name ?? null] as [string, string | null]
  }))

  // Group by member — amount/currency are already in the member's preferred currency
  const byMember = new Map<string, {
    pending: number[]; paid: number[]
    currency: string
    originalCurrencies: Set<string>
  }>()

  for (const r of rows) {
    if (!byMember.has(r.member_id)) {
      byMember.set(r.member_id, {
        pending:            [],
        paid:               [],
        currency:           r.currency ?? 'USD',
        originalCurrencies: new Set(),
      })
    }
    const entry = byMember.get(r.member_id)!
    if (r.status === 'pending') entry.pending.push(Number(r.converted_amount ?? r.amount))
    else                        entry.paid.push(Number(r.converted_amount ?? r.amount))
    if (r.original_currency) entry.originalCurrencies.add(r.original_currency)
  }

  const payrollRows: PayrollMemberRow[] = []

  for (const [memberId, data] of byMember.entries()) {
    const origCurrencies = [...data.originalCurrencies].filter((c) => c !== data.currency)
    payrollRows.push({
      member_id:         memberId,
      member_name:       profileMap.get(memberId) ?? null,
      pending_count:     data.pending.length,
      pending_amount:    data.pending.reduce((s, a) => s + a, 0),
      paid_count:        data.paid.length,
      paid_amount:       data.paid.reduce((s, a) => s + a, 0),
      currency:          data.currency,
      original_currency: origCurrencies.length === 1 ? origCurrencies[0] : (origCurrencies.length > 1 ? 'mixed' : null),
    })
  }

  payrollRows.sort((a, b) => b.pending_amount - a.pending_amount)

  // Totals are only meaningful if all members share the same currency
  const currencies = [...new Set(payrollRows.map((r) => r.currency))]
  const singleCurrency = currencies.length === 1 ? currencies[0] : null

  const totals = payrollRows.reduce(
    (acc, r) => ({
      pending_count:  acc.pending_count  + r.pending_count,
      pending_amount: acc.pending_amount + r.pending_amount,
      paid_count:     acc.paid_count     + r.paid_count,
      paid_amount:    acc.paid_amount    + r.paid_amount,
    }),
    { pending_count: 0, pending_amount: 0, paid_count: 0, paid_amount: 0 }
  )

  return { rows: payrollRows, currency: singleCurrency, totals }
}
