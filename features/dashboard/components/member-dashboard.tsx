'use client'

import {
  ListTodo,
  Zap,
  Eye,
  AlertTriangle,
  Calendar,
  Wallet,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { DashboardKpiCard } from './dashboard-kpi-card'
import { MyTasksWidget } from './my-tasks-widget'
import { MyReviewStatusWidget } from './my-review-status-widget'
import { UpcomingDeadlinesWidget } from './upcoming-deadlines-widget'
import { AssignedProjectsWidget } from './assigned-projects-widget'
import { RecentActivityWidget } from './recent-activity-widget'
import type { MemberDashboardData } from '../types'

interface MemberDashboardProps {
  data:     MemberDashboardData
  loading?: boolean
}

export function MemberDashboard({ data, loading = false }: MemberDashboardProps) {
  const { kpis, income_kpis, my_tasks, review_status, upcoming, assigned_projects, recent_activity } = data

  return (
    <div className="space-y-6">
      {/* Task KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardKpiCard
          title="Active Tasks"
          value={kpis.active_tasks}
          icon={ListTodo}
          href="/tasks"
          loading={loading}
        />
        <DashboardKpiCard
          title="In Progress"
          value={kpis.in_progress}
          icon={Zap}
          href="/tasks?status=in_progress"
          colorClass="text-emerald-500"
          loading={loading}
        />
        <DashboardKpiCard
          title="Awaiting Review"
          value={kpis.in_review}
          icon={Eye}
          href="/tasks?status=review"
          colorClass="text-violet-500"
          loading={loading}
        />
        <DashboardKpiCard
          title="Overdue"
          value={kpis.overdue}
          icon={AlertTriangle}
          colorClass={kpis.overdue > 0 ? 'text-red-500' : 'text-muted-foreground'}
          loading={loading}
        />
        <DashboardKpiCard
          title="Due This Week"
          value={kpis.due_this_week}
          icon={Calendar}
          colorClass="text-amber-500"
          loading={loading}
        />
      </div>

      {/* Income KPI Grid */}
      {income_kpis.completed_tasks > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardKpiCard
            title="This Month Income"
            value={income_kpis.this_month_income}
            icon={Wallet}
            href="/income"
            isCurrency
            currency={income_kpis.currency}
            colorClass="text-emerald-500"
            loading={loading}
          />
          <DashboardKpiCard
            title="Pending Income"
            value={income_kpis.pending_income}
            icon={Clock}
            href="/income"
            isCurrency
            currency={income_kpis.currency}
            colorClass="text-amber-500"
            loading={loading}
          />
          <DashboardKpiCard
            title="Paid Income"
            value={income_kpis.paid_income}
            icon={CheckCircle2}
            href="/income"
            isCurrency
            currency={income_kpis.currency}
            colorClass="text-blue-500"
            loading={loading}
          />
          <DashboardKpiCard
            title="Completed Tasks"
            value={income_kpis.completed_tasks}
            icon={CheckCircle2}
            colorClass="text-muted-foreground"
            loading={loading}
          />
        </div>
      )}

      {/* My Tasks (primary) */}
      <MyTasksWidget items={my_tasks} loading={loading} />

      {/* Review status + Upcoming deadlines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MyReviewStatusWidget items={review_status} loading={loading} />
        <UpcomingDeadlinesWidget items={upcoming} loading={loading} />
      </div>

      {/* Assigned projects + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AssignedProjectsWidget items={assigned_projects} loading={loading} />
        <RecentActivityWidget items={recent_activity} loading={loading} />
      </div>
    </div>
  )
}
