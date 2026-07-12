import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { IncomeListItem, IncomeFilters, GetIncomeResult, IncomeSummary, IncomeStatus } from '../types'

type TypedClient = SupabaseClient<Database>

const PAGE_SIZE = 20

export async function dbGetIncome(
  supabase: TypedClient,
  orgId:    string,
  filters:  IncomeFilters = {}
): Promise<GetIncomeResult> {
  const page     = filters.page     ?? 1
  const pageSize = filters.pageSize ?? PAGE_SIZE
  const offset   = (page - 1) * pageSize

  let query = supabase
    .from('member_income')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)

  if (filters.memberId) query = query.eq('member_id', filters.memberId)
  if (filters.status)   query = query.eq('status',    filters.status)
  if (filters.from)     query = query.gte('completed_at', filters.from)
  if (filters.to)       query = query.lte('completed_at', filters.to + 'T23:59:59Z')

  query = query.order('completed_at', { ascending: false }).range(offset, offset + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 }
  }

  // Enrich: fetch member profiles and task titles
  const memberIds = [...new Set(rows.map((r) => r.member_id))]
  const taskIds   = [...new Set(rows.map((r) => r.task_id))]

  const [profilesRes, tasksRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', memberIds),
    supabase.from('tasks').select('id, title, project_id').in('id', taskIds),
  ])

  const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  const taskRows  = tasksRes.data ?? []
  const taskMap   = Object.fromEntries(taskRows.map((t) => [t.id, t]))
  const projectIds = [...new Set(taskRows.map((t) => t.project_id).filter(Boolean))] as string[]

  let projectMap: Record<string, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds)
    projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]))
  }

  const items: IncomeListItem[] = rows.map((r) => {
    const task = taskMap[r.task_id]
    return {
      ...r,
      status:       r.status as IncomeStatus,
      member_name:  profileMap[r.member_id] ?? null,
      task_title:   task?.title            ?? null,
      project_name: task ? (projectMap[task.project_id] ?? null) : null,
    }
  })

  return { items, total: count ?? 0, page, pageSize, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) }
}

export async function dbGetIncomeSummary(
  supabase:           TypedClient,
  orgId:              string,
  memberId?:          string,
  orgPayrollCurrency?: string,
): Promise<IncomeSummary> {
  let query = supabase
    .from('member_income')
    .select('status, amount, currency')
    .eq('organization_id', orgId)

  if (memberId) query = query.eq('member_id', memberId)

  const { data } = await query
  const rows = data ?? []

  const pending = rows.filter((r) => r.status === 'pending')
  const paid    = rows.filter((r) => r.status === 'paid')

  // For member-scoped queries all rows share the same currency (member's preferred).
  // For org-wide queries use the org's payroll currency as the canonical fallback.
  const currency = rows[0]?.currency ?? orgPayrollCurrency ?? 'USD'

  return {
    pending_count:  pending.length,
    pending_amount: pending.reduce((s, r) => s + Number(r.amount), 0),
    paid_count:     paid.length,
    paid_amount:    paid.reduce((s, r) => s + Number(r.amount), 0),
    currency,
  }
}
