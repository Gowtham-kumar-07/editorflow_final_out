import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ProjectStatus } from '@/types/supabase'
import type {
  AdminDashboardData,
  PmDashboardData,
  MemberDashboardData,
  RevenueTrendMonth,
  ProjectStatusCount,
  FinancialAttentionItem,
  RecentPaymentItem,
  ReviewQueueItem,
  UpcomingDeadlineItem,
  ProjectHealthItem,
  TeamWorkloadMember,
  MyTaskItem,
  AssignedProjectItem,
  DashboardActivityItem,
} from '../types'

type TypedClient = SupabaseClient<Database>
type TaskStatus   = Database['public']['Enums']['task_status']

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'review']
const ACTIVE_WORKLOAD_STATUSES: TaskStatus[]    = ['todo', 'in_progress', 'blocked']
const OPEN_TASK_STATUSES: TaskStatus[]          = ['todo', 'in_progress', 'blocked', 'review']
const FINANCIALLY_ACTIVE_INVOICE_STATUSES       = ['sent', 'overdue', 'partial'] as const

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function monthStartStr(): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]
}

function trendWindowStr(): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth() - 5, 1).toISOString().split('T')[0]
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function fetchReviewQueue(
  supabase: TypedClient,
  orgId: string,
  limit = 5
): Promise<ReviewQueueItem[]> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, project_id, assigned_to, updated_at, due_date')
    .eq('organization_id', orgId)
    .eq('status', 'review')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!tasks || tasks.length === 0) return []

  const projectIds  = [...new Set(tasks.map((t) => t.project_id))]
  const assigneeIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[]

  const [projectsRes, profilesRes] = await Promise.all([
    supabase.from('projects').select('id, name').in('id', projectIds),
    assigneeIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', assigneeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ])

  const projectMap  = Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p.name]))
  const profileMap  = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  return tasks.map((t) => ({
    id:            t.id,
    title:         t.title,
    project_id:    t.project_id,
    project_name:  projectMap[t.project_id] ?? '—',
    assignee_name: t.assigned_to ? (profileMap[t.assigned_to] ?? null) : null,
    updated_at:    t.updated_at,
    due_date:      t.due_date ?? null,
  }))
}

async function fetchUpcomingDeadlines(
  supabase: TypedClient,
  orgId: string,
  limit = 8,
  assigneeId?: string
): Promise<UpcomingDeadlineItem[]> {
  const today   = todayStr()
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  let query = supabase
    .from('tasks')
    .select('id, title, project_id, assigned_to, due_date, status')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', [...ACTIVE_WORKLOAD_STATUSES, 'review'])
    .not('due_date', 'is', null)
    .lte('due_date', weekEnd)

  if (assigneeId) query = query.eq('assigned_to', assigneeId)

  const { data: tasks } = await query
    .order('due_date', { ascending: true })
    .limit(limit * 2)

  if (!tasks || tasks.length === 0) return []

  const projectIds  = [...new Set(tasks.map((t) => t.project_id))]
  const assigneeIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[]

  const [projectsRes, profilesRes] = await Promise.all([
    supabase.from('projects').select('id, name').in('id', projectIds),
    assigneeIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', assigneeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ])

  const projectMap = Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p.name]))
  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  const items: UpcomingDeadlineItem[] = tasks
    .filter((t) => t.due_date !== null)
    .map((t) => ({
      id:            t.id,
      title:         t.title,
      project_id:    t.project_id,
      project_name:  projectMap[t.project_id] ?? '—',
      assignee_name: t.assigned_to ? (profileMap[t.assigned_to] ?? null) : null,
      due_date:      t.due_date!,
      status:        t.status as TaskStatus,
      is_overdue:    t.due_date! < today,
    }))

  // Sort: overdue first (earliest due date), then upcoming
  items.sort((a, b) => {
    if (a.is_overdue && !b.is_overdue) return -1
    if (!a.is_overdue && b.is_overdue) return 1
    return a.due_date < b.due_date ? -1 : 1
  })

  return items.slice(0, limit)
}

async function fetchRecentActivity(
  supabase: TypedClient,
  orgId: string,
  limit = 8
): Promise<DashboardActivityItem[]> {
  const { data: logs } = await supabase
    .from('activity_logs')
    .select('id, user_id, activity_type, entity_type, entity_id, metadata, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!logs || logs.length === 0) return []

  const userIds    = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[]
  const taskIds    = logs.filter((l) => l.entity_type === 'task').map((l) => l.entity_id)
  const projectIds = logs.filter((l) => l.entity_type === 'project').map((l) => l.entity_id)

  const [profilesRes, tasksRes, projectsRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    taskIds.length > 0
      ? supabase.from('tasks').select('id, title').in('id', taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    projectIds.length > 0
      ? supabase.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))
  const taskMap    = Object.fromEntries((tasksRes.data    ?? []).map((t) => [t.id, t.title]))
  const projectMap = Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p.name]))

  return logs.map((l) => {
    const meta = l.metadata as Record<string, unknown> | null
    let entityTitle: string | null = null
    if (l.entity_type === 'task')    entityTitle = taskMap[l.entity_id]    ?? (meta?.title as string | null) ?? null
    if (l.entity_type === 'project') entityTitle = projectMap[l.entity_id] ?? (meta?.name  as string | null) ?? null

    return {
      id:            l.id,
      user_id:       l.user_id,
      user_name:     l.user_id ? (profileMap[l.user_id] ?? null) : null,
      activity_type: l.activity_type,
      entity_type:   l.entity_type,
      entity_id:     l.entity_id,
      entity_title:  entityTitle,
      action:        (meta?.action as string | null) ?? null,
      created_at:    l.created_at,
    }
  })
}

// ─── Admin / Owner ─────────────────────────────────────────────────────────────

export async function dbGetAdminDashboard(
  supabase: TypedClient,
  orgId: string
): Promise<Omit<AdminDashboardData, 'role'>> {
  const today      = todayStr()
  const monthStart = monthStartStr()
  const trendStart = trendWindowStr()

  // Parallel: org (for base currency), projects, tasks, payments, invoices, members, activity
  const [
    orgRes,
    projectsRes,
    tasksRes,
    paymentsRes,
    invoicesRes,
    membersRes,
    reviewQueue,
    recentActivity,
    recentPaymentRowsRes,
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('default_currency')
      .eq('id', orgId)
      .maybeSingle(),

    supabase
      .from('projects')
      .select('status')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'archived'),

    supabase
      .from('tasks')
      .select('status')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'review'),

    supabase
      .from('payments')
      // base_amount is the FX-adjusted equivalent stored at payment time; gte limits to 6-month window
      .select('amount, base_amount, payment_date')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('payment_date', trendStart),

    supabase
      .from('invoices')
      .select('id, invoice_number, balance_due, due_date, status, currency, client_id, deleted_at')
      .eq('organization_id', orgId)
      .in('status', [...FINANCIALLY_ACTIVE_INVOICE_STATUSES])
      .is('deleted_at', null),

    supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    fetchReviewQueue(supabase, orgId, 5),
    fetchRecentActivity(supabase, orgId, 8),
    supabase
      .from('payments')
      .select(`id, amount, base_amount, payment_date, payment_method,
               invoices(id, invoice_number, currency, client_id,
                 clients(id, company_name))`)
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .order('created_at',   { ascending: false })
      .limit(5),
  ])

  const baseCurrency = orgRes.data?.default_currency ?? 'USD'
  const allProjects  = projectsRes.data ?? []
  const payments     = paymentsRes.data ?? []
  const invoices     = invoicesRes.data ?? []

  // KPI: active projects
  const active_projects = allProjects.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus)
  ).length

  // KPI: tasks in review
  const tasks_in_review = tasksRes.count !== null ? tasksRes.count : (tasksRes.data?.length ?? 0)

  // KPI: revenue this month — uses base_amount (FX-adjusted) for correct cross-currency aggregation
  const revenue_this_month = payments
    .filter((p) => p.payment_date >= monthStart)
    .reduce((s, p) => s + Number(p.base_amount ?? p.amount), 0)

  // KPI: outstanding balance — only invoices in the org's base currency to avoid
  // cross-currency addition (unpaid invoices have no base_amount snapshot)
  const outstanding_balance = invoices
    .filter((i) => (i.currency ?? '').toUpperCase() === baseCurrency.toUpperCase())
    .reduce((s, i) => s + Number(i.balance_due), 0)

  // KPI: overdue invoices
  const overdue_invoices = invoices.filter(
    (i) => i.due_date && i.due_date < today && Number(i.balance_due) > 0
  ).length

  // KPI: active members
  const active_members = membersRes.data?.length ?? 0

  // Revenue trend: last 6 months using base_amount
  const revenue_trend = buildRevenueTrend(payments)

  // Project status distribution (excluding archived)
  const project_status_dist = buildProjectStatusDist(allProjects)

  // Financial attention invoices (up to 5)
  const clientIds = [...new Set(invoices.map((i) => i.client_id))]
  let clientMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, company_name')
      .in('id', clientIds)
    clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name]))
  }

  const financial_attention: FinancialAttentionItem[] = invoices
    .filter((i) => Number(i.balance_due) > 0)
    .sort((a, b) => {
      const aOver = a.due_date && a.due_date < today
      const bOver = b.due_date && b.due_date < today
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      // partial before sent
      if (a.status === 'partial' && b.status !== 'partial') return -1
      if (a.status !== 'partial' && b.status === 'partial') return 1
      // nearest due date
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date < b.due_date ? -1 : 1
    })
    .slice(0, 5)
    .map((i) => ({
      id:             i.id,
      invoice_number: i.invoice_number,
      client_name:    clientMap[i.client_id] ?? '—',
      due_date:       i.due_date ?? null,
      balance_due:    Number(i.balance_due),
      currency:       i.currency,
      status:         i.status,
    }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent_payments: RecentPaymentItem[] = ((recentPaymentRowsRes.data ?? []) as any[]).map((r) => {
    const inv = r.invoices as {
      id: string; invoice_number: string; currency: string; client_id: string;
      clients: { id: string; company_name: string } | null
    } | null
    return {
      id:             r.id,
      invoice_id:     inv?.id ?? '',
      invoice_number: inv?.invoice_number ?? '',
      client_name:    inv?.clients?.company_name ?? '',
      amount:         Number(r.amount),
      currency:       inv?.currency ?? 'USD',
      payment_date:   r.payment_date,
      payment_method: r.payment_method ?? '',
      base_amount:    Number(r.base_amount ?? r.amount),
      base_currency:  baseCurrency,
    }
  })

  // Payroll KPIs
  const monthStartForPayroll = monthStartStr()
  const { data: payrollRows } = await supabase
    .from('member_income')
    .select('amount, currency, status, completed_at')
    .eq('organization_id', orgId)

  const allPayroll = payrollRows ?? []
  const payrollCurrency = allPayroll[0]?.currency ?? 'USD'

  const pending_payroll         = allPayroll.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0)
  const paid_this_month_payroll = allPayroll
    .filter((r) => r.status === 'paid' && r.completed_at >= monthStartForPayroll)
    .reduce((s, r) => s + Number(r.amount), 0)

  return {
    kpis: {
      active_projects, tasks_in_review, revenue_this_month, outstanding_balance, overdue_invoices, active_members,
      revenue_currency: baseCurrency,
      pending_payroll,
      paid_this_month_payroll,
      payroll_currency: payrollCurrency,
    },
    revenue_trend,
    project_status_dist,
    financial_attention,
    recent_payments,
    review_queue: reviewQueue,
    recent_activity: recentActivity,
  }
}

// ─── Project Manager ──────────────────────────────────────────────────────────

export async function dbGetPmDashboard(
  supabase: TypedClient,
  orgId: string
): Promise<Omit<PmDashboardData, 'role'>> {
  const today = todayStr()

  const [
    projectsRes,
    tasksRes,
    membersRes,
    reviewQueue,
    recentActivity,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, progress, client_id, deleted_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'archived'),

    supabase
      .from('tasks')
      .select('id, project_id, assigned_to, status, due_date')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', OPEN_TASK_STATUSES),

    supabase
      .from('organization_memberships')
      .select('id, user_id, role, specialization, profiles(id, full_name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    fetchReviewQueue(supabase, orgId, 8),
    fetchRecentActivity(supabase, orgId, 8),
  ])

  const allProjects = projectsRes.data ?? []
  const allTasks    = tasksRes.data    ?? []
  const members     = membersRes.data  ?? []

  // KPIs
  const active_projects   = allProjects.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus)).length
  const on_hold_projects  = allProjects.filter((p) => p.status === 'on_hold').length
  const tasks_in_progress = allTasks.filter((t) => t.status === 'in_progress').length
  const tasks_in_review   = allTasks.filter((t) => t.status === 'review').length
  const overdue_tasks     = allTasks.filter((t) =>
    ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus) &&
    t.due_date && t.due_date < today
  ).length
  const active_members    = members.length

  // Team workload
  const userIds = members.map((m) => m.user_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileMap = Object.fromEntries((members as any[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return [m.user_id, prof?.full_name ?? null]
  }))

  const workloadMap: Record<string, { active: number; in_review: number; overdue: number }> = {}
  for (const t of allTasks) {
    if (!t.assigned_to || !userIds.includes(t.assigned_to)) continue
    if (!workloadMap[t.assigned_to]) workloadMap[t.assigned_to] = { active: 0, in_review: 0, overdue: 0 }
    if (t.status === 'review') {
      workloadMap[t.assigned_to].in_review++
    } else if (ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus)) {
      workloadMap[t.assigned_to].active++
      if (t.due_date && t.due_date < today) workloadMap[t.assigned_to].overdue++
    }
  }

  const team_workload: TeamWorkloadMember[] = members
    .filter((m) => {
      const w = workloadMap[m.user_id]
      return w ? (w.active + w.in_review) > 0 : false
    })
    .sort((a, b) => {
      const wa = workloadMap[a.user_id] ?? { active: 0, in_review: 0, overdue: 0 }
      const wb = workloadMap[b.user_id] ?? { active: 0, in_review: 0, overdue: 0 }
      return (wb.active + wb.in_review) - (wa.active + wa.in_review)
    })
    .map((m) => ({
      user_id:        m.user_id,
      name:           profileMap[m.user_id] ?? 'Unknown',
      specialization: m.specialization ?? null,
      active_tasks:   workloadMap[m.user_id]?.active   ?? 0,
      in_review:      workloadMap[m.user_id]?.in_review ?? 0,
      overdue:        workloadMap[m.user_id]?.overdue   ?? 0,
    }))

  // Upcoming deadlines
  const upcoming = await fetchUpcomingDeadlines(supabase, orgId, 8)

  // Project health: active projects with task counts (max 6)
  const activeProjects = allProjects
    .filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status as ProjectStatus))
    .slice(0, 6)

  const activeProjectIds = activeProjects.map((p) => p.id)
  const tasksByProject: Record<string, { open: number; review: number; overdue: number }> = {}
  for (const t of allTasks) {
    if (!activeProjectIds.includes(t.project_id)) continue
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = { open: 0, review: 0, overdue: 0 }
    if (t.status === 'review') tasksByProject[t.project_id].review++
    else if (ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus)) {
      tasksByProject[t.project_id].open++
      if (t.due_date && t.due_date < today) tasksByProject[t.project_id].overdue++
    }
  }

  // Enrich project health with client names
  const hProjectClientIds = [...new Set(activeProjects.map((p) => p.client_id))]
  let hClientMap: Record<string, string> = {}
  if (hProjectClientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients').select('id, company_name').in('id', hProjectClientIds)
    hClientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name]))
  }

  const project_health: ProjectHealthItem[] = activeProjects.map((p) => ({
    id:            p.id,
    name:          p.name,
    status:        p.status as ProjectStatus,
    progress:      p.progress ?? 0,
    client_name:   hClientMap[p.client_id] ?? null,
    open_tasks:    tasksByProject[p.id]?.open    ?? 0,
    review_tasks:  tasksByProject[p.id]?.review  ?? 0,
    overdue_tasks: tasksByProject[p.id]?.overdue ?? 0,
  }))

  return {
    kpis: { active_projects, tasks_in_progress, tasks_in_review, overdue_tasks, active_members, on_hold_projects },
    review_queue:  reviewQueue,
    team_workload,
    upcoming,
    project_health,
    recent_activity: recentActivity,
  }
}

// ─── Member ────────────────────────────────────────────────────────────────────

export async function dbGetMemberDashboard(
  supabase: TypedClient,
  orgId: string,
  userId: string
): Promise<Omit<MemberDashboardData, 'role'>> {
  const today   = todayStr()
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // All assigned tasks for this member
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('id, title, project_id, status, priority, due_date, updated_at')
    .eq('organization_id', orgId)
    .eq('assigned_to', userId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  const tasks = allTasks ?? []

  // KPIs — only count non-completed
  const nonDone = tasks.filter((t) => t.status !== 'completed')
  const kpis = {
    active_tasks:  nonDone.length,
    in_progress:   tasks.filter((t) => t.status === 'in_progress').length,
    in_review:     tasks.filter((t) => t.status === 'review').length,
    overdue:       tasks.filter((t) =>
      ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus) &&
      t.due_date && t.due_date < today
    ).length,
    due_this_week: tasks.filter((t) =>
      t.status !== 'completed' &&
      t.due_date && t.due_date >= today && t.due_date <= weekEnd
    ).length,
  }

  // Enrich tasks with project names
  const projectIds = [...new Set(tasks.map((t) => t.project_id))]
  let projectMap: Record<string, { name: string; status: string; progress: number }> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status, progress')
      .in('id', projectIds)
    projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, { name: p.name, status: p.status, progress: p.progress ?? 0 }]))
  }

  // My Tasks: non-completed, up to 8, sorted by priority
  const statusOrder: Record<string, number> = { overdue: 0, in_progress: 1, todo: 2, blocked: 3, review: 4 }
  const my_tasks: MyTaskItem[] = tasks
    .filter((t) => t.status !== 'completed')
    .map((t) => ({
      id:           t.id,
      title:        t.title,
      project_id:   t.project_id,
      project_name: projectMap[t.project_id]?.name ?? '—',
      status:       t.status as TaskStatus,
      priority:     t.priority,
      due_date:     t.due_date ?? null,
      is_overdue:   ACTIVE_WORKLOAD_STATUSES.includes(t.status as TaskStatus) && !!t.due_date && t.due_date < today,
    }))
    .sort((a, b) => {
      if (a.is_overdue && !b.is_overdue) return -1
      if (!a.is_overdue && b.is_overdue) return 1
      const so = (statusOrder[a.is_overdue ? 'overdue' : a.status] ?? 99) - (statusOrder[b.is_overdue ? 'overdue' : b.status] ?? 99)
      if (so !== 0) return so
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date < b.due_date ? -1 : 1
    })
    .slice(0, 8)

  // Review status: tasks in review
  const review_status: import('../types').ReviewQueueItem[] = tasks
    .filter((t) => t.status === 'review')
    .map((t) => ({
      id:            t.id,
      title:         t.title,
      project_id:    t.project_id,
      project_name:  projectMap[t.project_id]?.name ?? '—',
      assignee_name: null,
      updated_at:    t.updated_at,
      due_date:      t.due_date ?? null,
    }))

  // Upcoming deadlines for this member
  const upcoming = await fetchUpcomingDeadlines(supabase, orgId, 8, userId)

  // Assigned projects via task relationships
  const projectTaskCounts: Record<string, number> = {}
  for (const t of tasks) {
    if (t.status !== 'completed') {
      projectTaskCounts[t.project_id] = (projectTaskCounts[t.project_id] ?? 0) + 1
    }
  }

  const assigned_projects: AssignedProjectItem[] = Object.entries(projectTaskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({
      id,
      name:     projectMap[id]?.name     ?? '—',
      status:   (projectMap[id]?.status  ?? 'planning') as ProjectStatus,
      progress: projectMap[id]?.progress ?? 0,
      my_tasks: count,
    }))

  // Activity: only events related to this user's tasks
  const myTaskIds = tasks.map((t) => t.id)
  let recent_activity: import('../types').DashboardActivityItem[] = []
  if (myTaskIds.length > 0) {
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('id, user_id, activity_type, entity_type, entity_id, metadata, created_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('entity_id', myTaskIds.slice(0, 50))
      .order('created_at', { ascending: false })
      .limit(8)

    if (logs && logs.length > 0) {
      const uids = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[]
      let pMap: Record<string, string | null> = {}
      if (uids.length > 0) {
        const { data: ps } = await supabase.from('profiles').select('id, full_name').in('id', uids)
        pMap = Object.fromEntries((ps ?? []).map((p) => [p.id, p.full_name]))
      }
      const tMap = Object.fromEntries(tasks.map((t) => [t.id, t.title]))

      recent_activity = logs.map((l) => {
        const meta = l.metadata as Record<string, unknown> | null
        return {
          id:            l.id,
          user_id:       l.user_id,
          user_name:     l.user_id ? (pMap[l.user_id] ?? null) : null,
          activity_type: l.activity_type,
          entity_type:   l.entity_type,
          entity_id:     l.entity_id,
          entity_title:  tMap[l.entity_id] ?? (meta?.title as string | null) ?? null,
          action:        (meta?.action as string | null) ?? null,
          created_at:    l.created_at,
        }
      })
    }
  }

  // Income KPIs for this member
  const monthStart = monthStartStr()
  const { data: incomeRows } = await supabase
    .from('member_income')
    .select('amount, currency, status, completed_at')
    .eq('organization_id', orgId)
    .eq('member_id', userId)

  const allIncome = incomeRows ?? []
  const currency  = allIncome[0]?.currency ?? 'USD'

  const income_kpis = {
    this_month_income: allIncome
      .filter((r) => r.status === 'pending' && r.completed_at >= monthStart)
      .reduce((s, r) => s + Number(r.amount), 0),
    pending_income:    allIncome.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0),
    paid_income:       allIncome.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0),
    completed_tasks:   allIncome.length,
    currency,
  }

  return { kpis, income_kpis, my_tasks, review_status, upcoming, assigned_projects, recent_activity }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildRevenueTrend(
  payments: { amount: number; base_amount?: number; payment_date: string }[]
): RevenueTrendMonth[] {
  const months: RevenueTrendMonth[] = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d    = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const mon  = d.getMonth()
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })

    // Use base_amount (FX-adjusted) so mixed-currency payments aggregate correctly
    const amount = payments
      .filter((p) => {
        const pd = new Date(p.payment_date)
        return pd.getFullYear() === year && pd.getMonth() === mon
      })
      .reduce((s, p) => s + Number(p.base_amount ?? p.amount), 0)

    months.push({ month: label, amount })
  }
  return months
}

function buildProjectStatusDist(
  projects: { status: string }[]
): ProjectStatusCount[] {
  const statusOrder: ProjectStatus[] = ['planning', 'active', 'on_hold', 'review', 'completed', 'cancelled', 'draft']
  const counts: Partial<Record<ProjectStatus, number>> = {}
  for (const p of projects) counts[p.status as ProjectStatus] = (counts[p.status as ProjectStatus] ?? 0) + 1

  return statusOrder
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => ({ status: s, count: counts[s]! }))
}
