'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { OrgRole } from '@/types/supabase'
import { canViewReports, canViewFinancialReports, canManagePayroll } from '@/lib/permissions'
import {
  dbGetOverviewReport,
  dbGetRevenueReport,
  dbGetReceivablesReport,
  dbGetClientRevenueReport,
  dbGetProjectDeliveryReport,
  dbGetTaskPerformanceReport,
  dbGetTeamPerformanceReport,
  dbGetBottlenecksReport,
  dbGetPayrollReport,
} from '../repository/report.repository'
import type {
  OverviewReport,
  RevenueReport,
  ReceivablesReport,
  ClientRevenueReport,
  ProjectDeliveryReport,
  TaskPerformanceReport,
  TeamPerformanceReport,
  BottlenecksReport,
  PayrollReport,
  ReportParams,
} from '../types'

// ─── Context resolution (mirrors dashboard pattern) ───────────────────────────

async function resolveReportContext() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

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

  if (!orgId) redirect('/onboarding')

  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role: OrgRole = (roleData as OrgRole | null) ?? 'member'

  if (!canViewReports(role)) redirect('/dashboard')

  return { supabase, orgId, userId: user.id, role }
}

// ─── Report actions ───────────────────────────────────────────────────────────

export async function getOverviewReportAction(params: ReportParams): Promise<OverviewReport> {
  const { supabase, orgId, role } = await resolveReportContext()
  if (!canViewFinancialReports(role)) redirect('/reports?tab=projects')
  return dbGetOverviewReport(supabase, orgId, params.from, params.to)
}

export async function getRevenueReportAction(params: ReportParams): Promise<RevenueReport> {
  const { supabase, orgId, role } = await resolveReportContext()
  if (!canViewFinancialReports(role)) redirect('/reports?tab=projects')
  return dbGetRevenueReport(supabase, orgId, params.from, params.to)
}

export async function getReceivablesReportAction(): Promise<ReceivablesReport> {
  const { supabase, orgId, role } = await resolveReportContext()
  if (!canViewFinancialReports(role)) redirect('/reports?tab=projects')
  return dbGetReceivablesReport(supabase, orgId)
}

export async function getClientRevenueReportAction(
  params: ReportParams,
): Promise<ClientRevenueReport> {
  const { supabase, orgId, role } = await resolveReportContext()
  if (!canViewFinancialReports(role)) redirect('/reports?tab=projects')
  return dbGetClientRevenueReport(supabase, orgId, params.from, params.to)
}

export async function getProjectDeliveryReportAction(
  params: ReportParams,
): Promise<ProjectDeliveryReport> {
  const { supabase, orgId } = await resolveReportContext()
  return dbGetProjectDeliveryReport(supabase, orgId, params.from, params.to)
}

export async function getTaskPerformanceReportAction(
  params: ReportParams,
): Promise<TaskPerformanceReport> {
  const { supabase, orgId } = await resolveReportContext()
  return dbGetTaskPerformanceReport(supabase, orgId, params.from, params.to)
}

export async function getTeamPerformanceReportAction(
  params: ReportParams,
): Promise<TeamPerformanceReport> {
  const { supabase, orgId } = await resolveReportContext()
  return dbGetTeamPerformanceReport(supabase, orgId, params.from, params.to)
}

export async function getBottlenecksReportAction(): Promise<BottlenecksReport> {
  const { supabase, orgId } = await resolveReportContext()
  return dbGetBottlenecksReport(supabase, orgId)
}

export async function getPayrollReportAction(): Promise<PayrollReport> {
  const { supabase, orgId, role } = await resolveReportContext()
  if (!canManagePayroll(role)) redirect('/reports?tab=projects')
  return dbGetPayrollReport(supabase, orgId)
}
