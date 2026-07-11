'use client'

import { DollarSign, CreditCard, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/utils/format'
import { useRevenueReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import { CurrencySection } from './currency-section'
import { CsvDownloadBtn } from './csv-download-btn'
import type { ReportDateRange } from '../types'

const METHOD_LABEL: Record<string, string> = {
  bank_transfer:   'Bank Transfer',
  credit_card:     'Credit Card',
  cash:            'Cash',
  cheque:          'Cheque',
  upi:             'UPI',
  paypal:          'PayPal',
  stripe:          'Stripe',
  other:           'Other',
  Other:           'Other',
}

interface RevenueReportProps {
  dateRange: ReportDateRange
}

export function RevenueReportView({ dateRange }: RevenueReportProps) {
  const { data, isLoading } = useRevenueReport(dateRange.from, dateRange.to)

  const byCur  = data?.by_currency  ?? []
  const byMeth = data?.by_method    ?? []
  const trend  = data?.monthly_trend ?? []
  const pmts   = data?.payments      ?? []
  const csvUrl = `/api/reports/revenue.csv?from=${dateRange.from}&to=${dateRange.to}`

  // Group trend by currency for chart
  const currencies = Array.from(new Set(trend.map(r => r.currency)))

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing completed payments · {dateRange.from} — {dateRange.to}
        </p>
        <CsvDownloadBtn
          href={csvUrl}
          filename={`revenue-${dateRange.from}-${dateRange.to}.csv`}
        />
      </div>

      {/* KPIs per currency */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : byCur.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No completed payments in this period.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {byCur.map(cur => (
            <CurrencySection key={cur.currency} currency={cur.currency}>
              <div className="grid gap-4 sm:grid-cols-3">
                <ReportKpiCard
                  title="Total Collected"
                  value={cur.total}
                  icon={DollarSign}
                  isCurrency
                  currency={cur.currency}
                  colorClass="text-emerald-500"
                />
                <ReportKpiCard
                  title="Payments Received"
                  value={cur.count}
                  icon={CreditCard}
                />
                <ReportKpiCard
                  title="Avg per Payment"
                  value={cur.count > 0 ? cur.total / cur.count : 0}
                  icon={TrendingUp}
                  isCurrency
                  currency={cur.currency}
                />
              </div>
            </CurrencySection>
          ))}
        </div>
      )}

      {/* Monthly trend (inline SVG bar chart) */}
      {!isLoading && trend.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Monthly Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {currencies.map(cur => {
              const rows = trend.filter(r => r.currency === cur)
              if (rows.length === 0) return null
              const maxVal = Math.max(...rows.map(r => r.amount), 1)
              const W = 540
              const H = 140
              const barW = Math.floor(W / rows.length) - 6
              return (
                <div key={cur} className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{cur}</p>
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full min-w-[320px]" aria-label={`Monthly revenue trend ${cur}`}>
                      {rows.map((r, i) => {
                        const barH = Math.max(4, Math.round((r.amount / maxVal) * H))
                        const x    = i * (barW + 6) + 3
                        const y    = H - barH
                        return (
                          <g key={r.month}>
                            <rect x={x} y={y} width={barW} height={barH}
                              className="fill-primary opacity-80 hover:opacity-100 transition-opacity"
                              rx="3"
                            />
                            <text
                              x={x + barW / 2} y={H + 18}
                              textAnchor="middle"
                              className="fill-muted-foreground text-[10px]"
                              fontSize="10"
                            >
                              {r.label.split(' ')[0]}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Payment method breakdown */}
      {!isLoading && byMeth.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.from(new Set(byMeth.map(r => r.currency))).map(cur => {
              const rows = byMeth.filter(r => r.currency === cur)
              const total = rows.reduce((s, r) => s + r.amount, 0)
              return (
                <CurrencySection key={cur} currency={cur} className="mb-4">
                  <div className="space-y-2">
                    {rows.map(r => {
                      const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
                      return (
                        <div key={r.method} className="flex items-center gap-3 text-sm">
                          <span className="w-28 truncate font-medium">
                            {METHOD_LABEL[r.method] ?? r.method}
                          </span>
                          <div className="flex-1">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-10 text-right tabular-nums text-muted-foreground">{pct}%</span>
                          <span className="w-28 text-right tabular-nums">
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

      {/* Payments table */}
      {!isLoading && pmts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">All Payments ({pmts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Date</th>
                    <th className="pb-2 text-left font-medium">Client</th>
                    <th className="pb-2 text-left font-medium">Invoice</th>
                    <th className="pb-2 text-left font-medium">Method</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pmts.slice(0, 100).map(p => (
                    <tr key={p.id}>
                      <td className="py-2 text-muted-foreground">{formatDate(p.payment_date)}</td>
                      <td className="py-2 font-medium">{p.client_name}</td>
                      <td className="py-2 text-muted-foreground">{p.invoice_number}</td>
                      <td className="py-2 text-muted-foreground">
                        {METHOD_LABEL[p.payment_method ?? 'other'] ?? p.payment_method}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pmts.length > 100 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing first 100 of {pmts.length} · Export CSV for full data
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
