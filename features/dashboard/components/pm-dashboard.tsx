'use client'

import {
  FolderKanban,
  Zap,
  ClipboardCheck,
  AlertTriangle,
  Users,
  PauseCircle,
} from 'lucide-react'
import { DashboardKpiCard } from './dashboard-kpi-card'
import { ReviewQueueWidget } from './review-queue-widget'
import { TeamWorkloadWidget } from './team-workload-widget'
import { UpcomingDeadlinesWidget } from './upcoming-deadlines-widget'
import { ProjectHealthWidget } from './project-health-widget'
import { RecentActivityWidget } from './recent-activity-widget'
import type { PmDashboardData } from '../types'

interface PmDashboardProps {
  data:     PmDashboardData
  loading?: boolean
}

export function PmDashboard({ data, loading = false }: PmDashboardProps) {
  const { kpis, review_queue, team_workload, upcoming, project_health, recent_activity } = data

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
          title="In Progress"
          value={kpis.tasks_in_progress}
          icon={Zap}
          href="/tasks?status=in_progress"
          colorClass="text-emerald-500"
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
          title="Overdue Tasks"
          value={kpis.overdue_tasks}
          icon={AlertTriangle}
          colorClass={kpis.overdue_tasks > 0 ? 'text-red-500' : 'text-muted-foreground'}
          loading={loading}
        />
        <DashboardKpiCard
          title="Active Members"
          value={kpis.active_members}
          icon={Users}
          href="/team"
          loading={loading}
        />
        <DashboardKpiCard
          title="On Hold"
          value={kpis.on_hold_projects}
          icon={PauseCircle}
          colorClass="text-amber-500"
          loading={loading}
        />
      </div>

      {/* Review queue (prominent) */}
      <ReviewQueueWidget items={review_queue} loading={loading} maxItems={8} />

      {/* Team workload + Upcoming deadlines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamWorkloadWidget members={team_workload} loading={loading} />
        <UpcomingDeadlinesWidget items={upcoming} loading={loading} />
      </div>

      {/* Project health + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectHealthWidget items={project_health} loading={loading} />
        <RecentActivityWidget items={recent_activity} loading={loading} />
      </div>
    </div>
  )
}
