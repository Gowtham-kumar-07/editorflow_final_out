'use client'

import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatCurrency } from '@/utils/format'
import type { RecentPaymentItem } from '../types'

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  upi:           'UPI',
  cash:          'Cash',
  cheque:        'Cheque',
  card:          'Card',
  wire:          'Wire',
  other:         'Other',
}

interface RecentPaymentsWidgetProps {
  items:    RecentPaymentItem[]
  loading?: boolean
}

export function RecentPaymentsWidget({ items, loading = false }: RecentPaymentsWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Recent Payments
            </CardTitle>
            <CardDescription>Latest collected payments</CardDescription>
          </div>
          <Link href="/payments" className="text-xs text-primary hover:underline shrink-0">
            View all payments →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No recent payments.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.client_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Link
                      href={`/invoices/${item.invoice_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {item.invoice_number}
                    </Link>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-muted-foreground">
                      {METHOD_LABEL[item.payment_method] ?? item.payment_method}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold font-mono">
                    {formatCurrency(item.amount, item.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.payment_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
