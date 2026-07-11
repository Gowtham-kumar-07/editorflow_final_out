'use client'

import { TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'
import { useClientRevenueReport } from '../hooks/use-reports'
import { ReportKpiCard } from './report-kpi-card'
import { CurrencySection } from './currency-section'
import { CsvDownloadBtn } from './csv-download-btn'
import type { ReportDateRange } from '../types'

interface ClientsReportProps {
  dateRange: ReportDateRange
}

export function ClientsReportView({ dateRange }: ClientsReportProps) {
  const { data, isLoading } = useClientRevenueReport(dateRange.from, dateRange.to)

  const rows       = data?.rows       ?? []
  const currencies = data?.currencies ?? []
  const csvUrl     = `/api/reports/clients.csv?from=${dateRange.from}&to=${dateRange.to}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Invoices issued · {dateRange.from} — {dateRange.to}
        </p>
        <CsvDownloadBtn
          href={csvUrl}
          filename={`clients-${dateRange.from}-${dateRange.to}.csv`}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No invoices issued in this period.
          </CardContent>
        </Card>
      ) : (
        currencies.map(cur => {
          const curRows = rows.filter(r => r.currency === cur)
          if (curRows.length === 0) return null
          const totInvoiced  = curRows.reduce((s, r) => s + r.invoiced_total, 0)
          const totPaid      = curRows.reduce((s, r) => s + r.paid_total, 0)
          const totOutstanding = curRows.reduce((s, r) => s + r.outstanding, 0)

          return (
            <div key={cur} className="space-y-4">
              <CurrencySection currency={cur}>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <ReportKpiCard
                    title="Total Invoiced"
                    value={totInvoiced}
                    icon={TrendingUp}
                    isCurrency
                    currency={cur}
                  />
                  <ReportKpiCard
                    title="Total Collected"
                    value={totPaid}
                    icon={TrendingUp}
                    isCurrency
                    currency={cur}
                    colorClass="text-emerald-500"
                  />
                  <ReportKpiCard
                    title="Outstanding"
                    value={totOutstanding}
                    icon={Clock}
                    isCurrency
                    currency={cur}
                    colorClass={totOutstanding > 0 ? 'text-amber-500' : 'text-foreground'}
                  />
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="px-4 py-3 text-left font-medium">Client</th>
                            <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                            <th className="px-4 py-3 text-right font-medium">Paid</th>
                            <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                            <th className="px-4 py-3 text-right font-medium">Invoices</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {curRows.map(r => (
                            <tr key={r.client_id} className="hover:bg-muted/40 transition-colors">
                              <td className="px-4 py-3 font-medium">{r.client_name}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {formatCurrency(r.invoiced_total, cur)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                                {formatCurrency(r.paid_total, cur)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={r.outstanding > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                                  {formatCurrency(r.outstanding, cur)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                {r.invoice_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </CurrencySection>
            </div>
          )
        })
      )}
    </div>
  )
}
