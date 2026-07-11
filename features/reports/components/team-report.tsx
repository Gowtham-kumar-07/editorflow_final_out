'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useTeamPerformanceReport } from '../hooks/use-reports'
import { CsvDownloadBtn } from './csv-download-btn'
import type { ReportDateRange } from '../types'

function initials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface TeamReportProps {
  dateRange: ReportDateRange
}

export function TeamReportView({ dateRange }: TeamReportProps) {
  const { data, isLoading } = useTeamPerformanceReport(dateRange.from, dateRange.to)

  const members = data?.members ?? []
  const csvUrl  = `/api/reports/team.csv?from=${dateRange.from}&to=${dateRange.to}`
  const maxCompleted = Math.max(...members.map(m => m.completed), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tasks created · {dateRange.from} — {dateRange.to}
        </p>
        <CsvDownloadBtn
          href={csvUrl}
          filename={`team-${dateRange.from}-${dateRange.to}.csv`}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No team members found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Visual output chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Task Output by Member</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map(m => {
                  const pct = Math.round((m.completed / maxCompleted) * 100)
                  return (
                    <div key={m.user_id} className="flex items-center gap-3">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="w-28 truncate text-sm font-medium">{m.name}</span>
                      <div className="flex-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-6 text-right tabular-nums text-sm font-semibold">
                        {m.completed}
                      </span>
                      <span className="text-xs text-muted-foreground">done</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detailed table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Member Breakdown ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Member</th>
                      <th className="pb-2 text-right font-medium">Completed</th>
                      <th className="pb-2 text-right font-medium">In Review</th>
                      <th className="pb-2 text-right font-medium">In Progress</th>
                      <th className="pb-2 text-right font-medium">Overdue</th>
                      <th className="pb-2 text-right font-medium">Total Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {members.map(m => (
                      <tr key={m.user_id}>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium leading-none">{m.name}</p>
                              {m.email && (
                                <p className="text-xs text-muted-foreground">{m.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-teal-600">
                          {m.completed}
                        </td>
                        <td className="py-2 text-right tabular-nums text-violet-600">
                          {m.in_review}
                        </td>
                        <td className="py-2 text-right tabular-nums text-blue-600">
                          {m.in_progress}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          <span className={m.overdue > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                            {m.overdue}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {m.total_active}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
