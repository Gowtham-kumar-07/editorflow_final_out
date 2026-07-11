export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/supabase/server'
import { canViewReports, canViewFinancialReports } from '@/lib/permissions'
import {
  dbGetRevenueReport,
  dbGetReceivablesReport,
  dbGetClientRevenueReport,
  dbGetProjectDeliveryReport,
  dbGetTaskPerformanceReport,
  dbGetTeamPerformanceReport,
} from '@/features/reports/repository/report.repository'
import { buildCsv, csvHeaders } from '@/features/reports/utils/csv'
import type { OrgRole } from '@/types/supabase'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveContext() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null

  if (!orgId) {
    const { data: mem } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    orgId = mem?.organization_id ?? null
  }

  if (!orgId) return null

  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role: OrgRole = (roleData as OrgRole | null) ?? 'member'

  return { supabase, orgId, role }
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report: reportSlug } = await params

  // Strip .csv extension if present
  const reportType = reportSlug.replace(/\.csv$/i, '')

  const sp   = req.nextUrl.searchParams
  const from = sp.get('from') ?? ''
  const to   = sp.get('to')   ?? ''

  // Validate date params for reports that require them
  const dateRequired = !['receivables', 'bottlenecks'].includes(reportType)
  if (dateRequired && (!from || !to)) {
    return badRequest('Missing required query params: from, to (YYYY-MM-DD)')
  }

  // Validate date format
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return badRequest('Invalid from date')
  if (to   && !/^\d{4}-\d{2}-\d{2}$/.test(to))   return badRequest('Invalid to date')

  const ctx = await resolveContext()
  if (!ctx) return unauthorized()

  const { supabase, orgId, role } = ctx
  if (!canViewReports(role)) return forbidden()

  const filename = `${reportType}-${from || 'current'}-${to || 'snapshot'}.csv`

  try {
    switch (reportType) {
      case 'revenue': {
        if (!canViewFinancialReports(role)) return forbidden()
        const data = await dbGetRevenueReport(supabase, orgId, from, to)
        const csv = buildCsv(
          ['Date', 'Client', 'Invoice', 'Method', 'Currency', 'Amount'],
          data.payments.map(p => [
            p.payment_date,
            p.client_name,
            p.invoice_number,
            p.payment_method ?? 'Other',
            p.currency,
            p.amount,
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      case 'receivables': {
        if (!canViewFinancialReports(role)) return forbidden()
        const data = await dbGetReceivablesReport(supabase, orgId)
        const csv = buildCsv(
          ['Invoice', 'Client', 'Issue Date', 'Due Date', 'Days Overdue', 'Currency', 'Balance Due'],
          data.overdue_invoices.map(i => [
            i.invoice_number,
            i.client_name,
            i.issue_date,
            i.due_date,
            i.days_overdue,
            i.currency,
            i.balance_due,
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      case 'clients': {
        if (!canViewFinancialReports(role)) return forbidden()
        const data = await dbGetClientRevenueReport(supabase, orgId, from, to)
        const csv = buildCsv(
          ['Client', 'Currency', 'Invoiced Total', 'Paid Total', 'Outstanding', 'Invoice Count'],
          data.rows.map(r => [
            r.client_name,
            r.currency,
            r.invoiced_total,
            r.paid_total,
            r.outstanding,
            r.invoice_count,
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      case 'projects': {
        const data = await dbGetProjectDeliveryReport(supabase, orgId, from, to)
        const csv = buildCsv(
          ['Project', 'Client', 'Status', 'Start Date', 'Due Date', 'Completed At', 'Progress %', 'On Time'],
          data.projects.map(p => [
            p.name,
            p.client_name ?? '',
            p.status,
            p.start_date   ?? '',
            p.due_date     ?? '',
            p.completed_at ?? '',
            p.progress,
            p.on_time === null ? '' : p.on_time ? 'Yes' : 'No',
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      case 'tasks': {
        const data = await dbGetTaskPerformanceReport(supabase, orgId, from, to)
        const csv = buildCsv(
          ['Task', 'Project', 'Assignee', 'Status', 'Priority', 'Due Date', 'Completed At', 'Overdue'],
          data.tasks.map(t => [
            t.title,
            t.project_name  ?? '',
            t.assignee_name ?? 'Unassigned',
            t.status,
            t.priority,
            t.due_date      ?? '',
            t.completed_at  ?? '',
            t.is_overdue ? 'Yes' : 'No',
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      case 'team': {
        const data = await dbGetTeamPerformanceReport(supabase, orgId, from, to)
        const csv = buildCsv(
          ['Member', 'Email', 'Completed', 'In Review', 'In Progress', 'Overdue', 'Total Active'],
          data.members.map(m => [
            m.name,
            m.email ?? '',
            m.completed,
            m.in_review,
            m.in_progress,
            m.overdue,
            m.total_active,
          ]),
        )
        return new NextResponse(csv, { headers: csvHeaders(filename) })
      }

      default:
        return badRequest(`Unknown report type: ${reportType}`)
    }
  } catch (err) {
    console.error('[reports/csv]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
