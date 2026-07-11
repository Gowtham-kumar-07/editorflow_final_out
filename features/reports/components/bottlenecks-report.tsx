'use client'

import { Clock, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utils/format'
import { useBottlenecksReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  blocked:     'Blocked',
}

const STATUS_COLOR: Record<string, string> = {
  todo:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  review:      'bg-violet-500',
  blocked:     'bg-red-500',
}

export function BottlenecksReportView() {
  const { data, isLoading } = useBottlenecksReport()

  const stuckTasks      = data?.stuck_tasks      ?? []
  const overdueProjects = data?.overdue_projects ?? []

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Current snapshot · tasks stale for 7+ days · projects past due date
      </p>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ReportKpiCard
          title="Stuck Tasks (7+ days)"
          value={stuckTasks.length}
          icon={Clock}
          colorClass={stuckTasks.length > 0 ? 'text-amber-500' : 'text-foreground'}
          loading={isLoading}
        />
        <ReportKpiCard
          title="Overdue Projects"
          value={overdueProjects.length}
          icon={FolderKanban}
          colorClass={overdueProjects.length > 0 ? 'text-red-500' : 'text-foreground'}
          loading={isLoading}
        />
      </div>

      {/* Stuck tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Stuck Tasks — not updated in 7+ days ({stuckTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : stuckTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No stuck tasks. Workflow is moving well.
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
                    <th className="pb-2 text-right font-medium">Days Stale</th>
                    <th className="pb-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stuckTasks.map(t => (
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
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[t.status] ?? 'bg-muted-foreground'}`} />
                          <span>{STATUS_LABEL[t.status] ?? t.status}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <Badge
                          variant={t.days_stale >= 30 ? 'destructive' : 'outline'}
                          className="font-mono"
                        >
                          {t.days_stale}d
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue projects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Overdue Projects ({overdueProjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : overdueProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No overdue projects. All active projects are on schedule.
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
                    <th className="pb-2 text-right font-medium">Overdue Tasks</th>
                    <th className="pb-2 text-right font-medium">Days Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overdueProjects.map(p => (
                    <tr key={p.id} className="bg-red-50 dark:bg-red-950/10">
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-muted-foreground">{p.client_name ?? '—'}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {p.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        {p.overdue_tasks > 0 ? (
                          <span className="text-red-500 font-medium">{p.overdue_tasks}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Badge variant="destructive" className="font-mono">
                          {p.days_overdue}d
                        </Badge>
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
