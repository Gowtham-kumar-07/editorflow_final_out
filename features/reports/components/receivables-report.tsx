'use client'

import { AlertTriangle, Clock, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/utils/format'
import { useReceivablesReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import { CurrencySection } from './currency-section'
import { CsvDownloadBtn } from './csv-download-btn'

export function ReceivablesReportView() {
  const { data, isLoading } = useReceivablesReport()

  const summaries      = data?.summary_by_currency ?? []
  const aging          = data?.aging               ?? []
  const overdueInvs    = data?.overdue_invoices    ?? []

  const agingCurrencies = Array.from(new Set(aging.map(a => a.currency)))
  const AGING_ORDER     = ['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Current snapshot · all open invoices (sent, partial, overdue)
        </p>
        <CsvDownloadBtn href="/api/reports/receivables.csv" filename="receivables.csv" />
      </div>

      {/* Summary KPIs per currency */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No outstanding invoices. All caught up!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {summaries.map(s => (
            <CurrencySection key={s.currency} currency={s.currency}>
              <div className="grid gap-4 sm:grid-cols-3">
                <ReportKpiCard
                  title="Total Outstanding"
                  value={s.total_outstanding}
                  icon={Clock}
                  isCurrency
                  currency={s.currency}
                />
                <ReportKpiCard
                  title="Total Overdue"
                  value={s.total_overdue}
                  icon={AlertTriangle}
                  isCurrency
                  currency={s.currency}
                  colorClass={s.total_overdue > 0 ? 'text-red-500' : 'text-foreground'}
                />
                <ReportKpiCard
                  title="Open Invoices"
                  value={s.count}
                  icon={FileText}
                />
              </div>
            </CurrencySection>
          ))}
        </div>
      )}

      {/* Aging buckets */}
      {!isLoading && aging.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Aging Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {agingCurrencies.map(cur => {
              const rows = AGING_ORDER.map(label => {
                const found = aging.find(a => a.label === label && a.currency === cur)
                return found ?? { label, days_min: 0, days_max: null, amount: 0, count: 0, currency: cur }
              })
              const maxAmount = Math.max(...rows.map(r => r.amount), 1)
              return (
                <CurrencySection key={cur} currency={cur} className="mb-4">
                  <div className="space-y-2">
                    {rows.map(r => {
                      const pct = Math.round((r.amount / maxAmount) * 100)
                      return (
                        <div key={r.label} className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-muted-foreground">{r.label}</span>
                          <div className="flex-1">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  r.label === '90+ days'
                                    ? 'bg-red-500'
                                    : r.label === '61–90 days'
                                    ? 'bg-orange-500'
                                    : r.label === '31–60 days'
                                    ? 'bg-amber-500'
                                    : r.label === '1–30 days'
                                    ? 'bg-yellow-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-8 text-right tabular-nums text-muted-foreground">{r.count}</span>
                          <span className="w-28 text-right tabular-nums font-medium">
                            {formatCurrency(r.amount, cur)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CurrencySection>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Overdue invoices table */}
      {!isLoading && overdueInvs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Overdue Invoices ({overdueInvs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Invoice</th>
                    <th className="pb-2 text-left font-medium">Client</th>
                    <th className="pb-2 text-left font-medium">Due Date</th>
                    <th className="pb-2 text-right font-medium">Days Overdue</th>
                    <th className="pb-2 text-right font-medium">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overdueInvs.map(inv => (
                    <tr key={inv.id}>
                      <td className="py-2 font-medium">{inv.invoice_number}</td>
                      <td className="py-2">{inv.client_name}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(inv.due_date)}</td>
                      <td className="py-2 text-right">
                        <Badge variant="destructive" className="font-mono">
                          {inv.days_overdue}d
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold text-red-500">
                        {formatCurrency(inv.balance_due, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
