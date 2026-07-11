'use client'

import {
  FolderKanban,
  ClipboardCheck,
  TrendingUp,
  Wallet,
  AlertCircle,
  Users,
  Clock,
  Banknote,
} from 'lucide-react'
import { DashboardKpiCard } from './dashboard-kpi-card'
import { RevenueOverviewChart } from './revenue-overview-chart'
import { ProjectStatusOverview } from './project-status-overview'
import { FinancialAttention } from './financial-attention'
import { RecentPaymentsWidget } from './recent-payments-widget'
import { ReviewQueueWidget } from './review-queue-widget'
import { RecentActivityWidget } from './recent-activity-widget'
import type { AdminDashboardData } from '../types'

interface AdminDashboardProps {
  data:     AdminDashboardData
  loading?: boolean
}

export function AdminDashboard({ data, loading = false }: AdminDashboardProps) {
  const { kpis, revenue_trend, project_status_dist, financial_attention, recent_payments, review_queue, recent_activity } = data

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardKpiCard
          title="Active Projects"
          value={kpis.active_projects}
          icon={FolderKanban}
          href="/projects"
          loading={loading}
        />
        <DashboardKpiCard
          title="Tasks in Review"
          value={kpis.tasks_in_review}
          icon={ClipboardCheck}
          href="/tasks?status=review"
          colorClass="text-violet-500"
          loading={loading}
        />
        <DashboardKpiCard
          title="Revenue This Month"
          value={kpis.revenue_this_month}
          icon={TrendingUp}
          href="/payments"
          isCurrency
          currency={kpis.revenue_currency}
          colorClass="text-emerald-500"
          loading={loading}
        />
        <DashboardKpiCard
          title="Outstanding Balance"
          value={kpis.outstanding_balance}
          icon={Wallet}
          href="/invoices"
          isCurrency
          currency={kpis.revenue_currency}
          colorClass="text-amber-500"
          loading={loading}
        />
        <DashboardKpiCard
          title="Overdue Invoices"
          value={kpis.overdue_invoices}
          icon={AlertCircle}
          href="/invoices"
          colorClass={kpis.overdue_invoices > 0 ? 'text-red-500' : 'text-muted-foreground'}
          loading={loading}
        />
        <DashboardKpiCard
          title="Active Members"
          value={kpis.active_members}
          icon={Users}
          href="/team"
          loading={loading}
        />
      </div>

      {/* Payroll KPIs */}
      {(kpis.pending_payroll > 0 || kpis.paid_this_month_payroll > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardKpiCard
            title="Pending Payroll"
            value={kpis.pending_payroll}
            icon={Clock}
            href="/income"
            isCurrency
            currency={kpis.payroll_currency}
            colorClass="text-amber-500"
            loading={loading}
          />
          <DashboardKpiCard
            title="Paid This Month"
            value={kpis.paid_this_month_payroll}
            icon={Banknote}
            href="/income"
            isCurrency
            currency={kpis.payroll_currency}
            colorClass="text-emerald-500"
            loading={loading}
          />
        </div>
      )}

      {/* Revenue chart + Project status */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueOverviewChart data={revenue_trend} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <ProjectStatusOverview data={project_status_dist} loading={loading} />
        </div>
      </div>

      {/* Financial attention + Recent payments */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FinancialAttention items={financial_attention} loading={loading} />
        <RecentPaymentsWidget items={recent_payments} loading={loading} />
      </div>

      {/* Review queue + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewQueueWidget items={review_queue} loading={loading} />
        <RecentActivityWidget items={recent_activity} loading={loading} />
      </div>
    </div>
  )
}
