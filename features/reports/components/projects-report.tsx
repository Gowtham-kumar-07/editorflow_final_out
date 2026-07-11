'use client'

import {
  FolderKanban,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utils/format'
import { useProjectDeliveryReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import { CsvDownloadBtn } from './csv-download-btn'
import type { ReportDateRange } from '../types'

const STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  review:    'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active:    'default',
  completed: 'secondary',
  on_hold:   'outline',
  review:    'secondary',
  cancelled: 'destructive',
}

interface ProjectsReportProps {
  dateRange: ReportDateRange
}

export function ProjectsReportView({ dateRange }: ProjectsReportProps) {
  const { data, isLoading } = useProjectDeliveryReport(dateRange.from, dateRange.to)

  const kpis     = data?.kpis
  const projects = data?.projects ?? []
  const csvUrl   = `/api/reports/projects.csv?from=${dateRange.from}&to=${dateRange.to}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Projects created · {dateRange.from} — {dateRange.to}
        </p>
        <CsvDownloadBtn
          href={csvUrl}
          filename={`projects-${dateRange.from}-${dateRange.to}.csv`}
        />
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ReportKpiCard
          title="Total Projects"
          value={kpis?.total}
          icon={FolderKanban}
          loading={isLoading}
        />
        <ReportKpiCard
          title="Completed"
          value={kpis?.completed}
          icon={CheckCircle}
          colorClass="text-teal-500"
          loading={isLoading}
        />
        <ReportKpiCard
          title="In Progress"
          value={kpis?.in_progress}
          icon={Clock}
          colorClass="text-blue-500"
          loading={isLoading}
        />
        <ReportKpiCard
          title="Overdue"
          value={kpis?.overdue}
          icon={AlertTriangle}
          colorClass={kpis?.overdue ? 'text-red-500' : 'text-foreground'}
          loading={isLoading}
        />
        <ReportKpiCard
          title="On-Time Rate"
          value={kpis?.on_time_rate}
          icon={TrendingUp}
          suffix="%"
          colorClass={
            kpis?.on_time_rate == null
              ? 'text-muted-foreground'
              : kpis.on_time_rate >= 80
              ? 'text-emerald-500'
              : kpis.on_time_rate >= 60
              ? 'text-amber-500'
              : 'text-red-500'
          }
          loading={isLoading}
          note={kpis?.on_time_rate == null ? 'No completed projects with due dates' : undefined}
        />
      </div>

      {/* Projects table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No projects created in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Project</th>
                    <th className="pb-2 text-left font-medium">Client</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Progress</th>
                    <th className="pb-2 text-right font-medium">Due Date</th>
                    <th className="pb-2 text-right font-medium">Completed</th>
                    <th className="pb-2 text-right font-medium">On Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projects.map(p => (
                    <tr key={p.id} className={p.is_overdue ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-muted-foreground">{p.client_name ?? '—'}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 overflow-hidden rounded-full bg-muted h-1.5">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <span className="w-8 tabular-nums text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {p.due_date ? formatDate(p.due_date) : '—'}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {p.completed_at ? formatDate(p.completed_at) : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {p.on_time === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : p.on_time ? (
                          <span className="text-emerald-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-red-500 font-medium">Late</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
