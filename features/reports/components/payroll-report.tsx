'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { usePayrollReport } from '../hooks/use-reports'

function fmt(n: number, currency: string) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
}

function downloadCsv(rows: { member_name: string | null; pending_count: number; pending_amount: number; paid_count: number; paid_amount: number; currency: string }[]) {
  const header = 'Member,Pending Tasks,Pending Amount,Paid Tasks,Paid Amount,Currency'
  const lines  = rows.map((r) =>
    [r.member_name ?? 'Unknown', r.pending_count, r.pending_amount.toFixed(2), r.paid_count, r.paid_amount.toFixed(2), r.currency].join(',')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `payroll-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function PayrollReportView() {
  const { data, isLoading } = usePayrollReport()

  const rows     = data?.rows    ?? []
  const totals   = data?.totals
  const currency = data?.currency ?? 'USD'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Internal payroll summary — all time</p>
        {rows.length > 0 && (
          <button
            onClick={() => downloadCsv(rows)}
            className="text-sm text-primary hover:underline"
          >
            Export CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No payroll records found. Income is created automatically when tasks are marked as completed.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          {totals && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Pending</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {fmt(totals.pending_amount, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">{totals.pending_count} records</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmt(totals.paid_amount, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">{totals.paid_count} records</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Member breakdown table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Member Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground text-xs">
                      <th className="pb-2 font-medium">Member</th>
                      <th className="pb-2 font-medium text-right">Pending</th>
                      <th className="pb-2 font-medium text-right">Paid</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.member_id} className="py-2">
                        <td className="py-2 font-medium">{r.member_name ?? '—'}</td>
                        <td className="py-2 text-right">
                          {r.pending_count > 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                                {r.pending_count}
                              </Badge>
                              <span className="font-mono">{fmt(r.pending_amount, r.currency)}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {r.paid_count > 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                                {r.paid_count}
                              </Badge>
                              <span className="font-mono">{fmt(r.paid_amount, r.currency)}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">
                          {fmt(r.pending_amount + r.paid_amount, r.currency)}
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
