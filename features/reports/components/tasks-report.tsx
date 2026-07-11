'use client'

import { CheckSquare, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utils/format'
import { useTaskPerformanceReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import { CsvDownloadBtn } from './csv-download-btn'
import type { ReportDateRange } from '../types'

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  blocked:     'Blocked',
  completed:   'Completed',
}


interface TasksReportProps {
  dateRange: ReportDateRange
}

export function TasksReportView({ dateRange }: TasksReportProps) {
  const { data, isLoading } = useTaskPerformanceReport(dateRange.from, dateRange.to)

  const kpis  = data?.kpis
  const tasks = data?.tasks ?? []
  const csvUrl = `/api/reports/tasks.csv?from=${dateRange.from}&to=${dateRange.to}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tasks created · {dateRange.from} — {dateRange.to}
        </p>
        <CsvDownloadBtn
          href={csvUrl}
          filename={`tasks-${dateRange.from}-${dateRange.to}.csv`}
        />
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard
          title="Total Tasks"
          value={kpis?.total}
          icon={CheckSquare}
          loading={isLoading}
        />
        <ReportKpiCard
          title="Completed"
          value={kpis?.completed}
          icon={CheckSquare}
          colorClass="text-teal-500"
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
          title="Completion Rate"
          value={kpis?.completion_rate}
          icon={TrendingUp}
          suffix="%"
          colorClass={
            kpis?.completion_rate === undefined
              ? 'text-foreground'
              : kpis.completion_rate >= 80
              ? 'text-emerald-500'
              : kpis.completion_rate >= 60
              ? 'text-amber-500'
              : 'text-red-500'
          }
          loading={isLoading}
        />
      </div>

      {/* Tasks table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks created in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Task</th>
                    <th className="pb-2 text-left font-medium">Project</th>
                    <th className="pb-2 text-left font-medium">Assignee</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tasks.slice(0, 150).map(t => (
                    <tr key={t.id} className={t.is_overdue ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            t.priority === 'urgent' ? 'bg-red-500' :
                            t.priority === 'high'   ? 'bg-amber-500' :
                            t.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-400'
                          }`} />
                          <span className="font-medium line-clamp-1">{t.title}</span>
                        </div>
                      </td>
                      <td className="py-2 text-muted-foreground">{t.project_name ?? '—'}</td>
                      <td className="py-2 text-muted-foreground">{t.assignee_name ?? 'Unassigned'}</td>
                      <td className="py-2">
                        <Badge variant={t.status === 'completed' ? 'secondary' : 'outline'} className="text-xs">
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {t.due_date ? (
                          <span className={t.is_overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                            {formatDate(t.due_date)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length > 150 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing first 150 of {tasks.length} · Export CSV for full data
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
