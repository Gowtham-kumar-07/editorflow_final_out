'use client'

import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/error-boundary'
import { useDashboard } from '../hooks/use-dashboard'
import { AdminDashboard } from './admin-dashboard'
import { PmDashboard } from './pm-dashboard'
import { MemberDashboard } from './member-dashboard'
import { useOrganizationContext } from '@/components/providers/organization-provider'
import type { AdminDashboardData, PmDashboardData, MemberDashboardData, DashboardData } from '../types'

const LOADING_SKELETON: AdminDashboardData = {
  role:                 'owner',
  kpis: {
    active_projects:         0,
    tasks_in_review:         0,
    revenue_this_month:      0,
    outstanding_balance:     0,
    overdue_invoices:        0,
    active_members:          0,
    revenue_currency:        'USD',
    pending_payroll:         0,
    paid_this_month_payroll: 0,
    payroll_currency:        'USD',
  },
  revenue_trend:        [],
  project_status_dist:  [],
  financial_attention:  [],
  recent_payments:      [],
  review_queue:         [],
  recent_activity:      [],
}

export function DashboardClient() {
  const { data, isLoading, isError, refetch } = useDashboard()
  const { organization } = useOrganizationContext()
  const orgName = organization?.name ?? ''

  if (isLoading) {
    return <AdminDashboard data={LOADING_SKELETON} orgName={orgName} loading />
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="mt-4 text-sm font-medium">Unable to load dashboard</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          There was a problem loading your dashboard data.
        </p>
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => refetch()}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    )
  }

  const d = data as DashboardData

  if (d.role === 'owner' || d.role === 'admin') {
    return (
      <ErrorBoundary label="admin-dashboard">
        <AdminDashboard data={d as AdminDashboardData} orgName={orgName} />
      </ErrorBoundary>
    )
  }

  if (d.role === 'project_manager') {
    return (
      <ErrorBoundary label="pm-dashboard">
        <PmDashboard data={d as PmDashboardData} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary label="member-dashboard">
      <MemberDashboard data={d as MemberDashboardData} />
    </ErrorBoundary>
  )
}
