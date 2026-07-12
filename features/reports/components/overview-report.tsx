'use client'

import {
  DollarSign,
  AlertTriangle,
  FileText,
  CheckCircle,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'
import { useOverviewReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import type { ReportDateRange } from '../types'

const STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  review:    'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived:  'Archived',
}

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-slate-400',
  planning:  'bg-blue-400',
  active:    'bg-emerald-500',
  on_hold:   'bg-amber-400',
  review:    'bg-violet-500',
  completed: 'bg-teal-500',
  cancelled: 'bg-rose-400',
  archived:  'bg-muted-foreground',
}

interface OverviewReportProps {
  dateRange: ReportDateRange
}

export function OverviewReportView({ dateRange }: OverviewReportProps) {
  const { data, isLoading } = useOverviewReport(dateRange.from, dateRange.to)

  const kpis       = data?.kpis
  const orgCur     = data?.org_currency
  const byCur      = data?.revenue_by_currency ?? []
  const statusDist = data?.project_status_dist ?? []
  const topClients = data?.top_clients ?? []

  const totalProjects = statusDist.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportKpiCard
          title="Revenue in Period"
          value={kpis?.revenue_in_period}
          icon={DollarSign}
          isCurrency
          currency={orgCur}
          colorClass="text-emerald-500"
          loading={isLoading}
        />
        <ReportKpiCard
          title="Outstanding Balance"
          value={kpis?.outstanding_balance}
          icon={Clock}
          isCurrency
          currency={orgCur}
          loading={isLoading}
        />
        <ReportKpiCard
          title="Overdue Amount"
          value={kpis?.overdue_amount}
          icon={AlertTriangle}
          isCurrency
          currency={orgCur}
          colorClass={kpis?.overdue_amount ? 'text-red-500' : 'text-foreground'}
          loading={isLoading}
        />
        <ReportKpiCard
          title="Invoices Sent"
          value={kpis?.invoices_sent}
          icon={FileText}
          loading={isLoading}
          note="in selected period"
        />
        <ReportKpiCard
          title="Projects Completed"
          value={kpis?.projects_completed}
          icon={CheckCircle}
          colorClass="text-teal-500"
          loading={isLoading}
        />
        <ReportKpiCard
          title="On-Time Delivery"
          value={kpis?.on_time_delivery_rate}
          icon={TrendingUp}
          suffix="%"
          colorClass={
            kpis?.on_time_delivery_rate == null
              ? 'text-muted-foreground'
              : kpis.on_time_delivery_rate >= 80
              ? 'text-emerald-500'
              : kpis.on_time_delivery_rate >= 60
              ? 'text-amber-500'
              : 'text-red-500'
          }
          loading={isLoading}
          note={kpis?.on_time_delivery_rate == null ? 'No completed projects with due dates' : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Revenue by currency */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Revenue by Currency</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : byCur.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments in this period.</p>
            ) : (
              <div className="space-y-3">
                {byCur.map(r => (
                  <div key={r.currency} className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        {r.currency}
                      </span>
                      <p className="text-sm text-muted-foreground">{r.count} payment{r.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-base font-semibold tabular-nums">
                      {formatCurrency(r.total, r.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project status distribution */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Project Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : statusDist.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects found.</p>
            ) : (
              <div className="space-y-2">
                {statusDist.map(r => {
                  const pct = totalProjects > 0 ? Math.round((r.count / totalProjects) * 100) : 0
                  return (
                    <div key={r.status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {r.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_COLOR[r.status] ?? 'bg-muted-foreground'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top clients */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top Clients by Revenue (Period)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue recorded in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Client</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                    <th className="pb-2 text-right font-medium">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topClients.map(c => (
                    <tr key={`${c.client_id}-${c.currency}`} className="py-2">
                      <td className="py-2 font-medium">{c.client_name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(c.revenue, c.currency)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{c.currency}</td>
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
