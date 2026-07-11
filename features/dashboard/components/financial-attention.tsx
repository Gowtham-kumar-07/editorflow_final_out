'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatCurrency } from '@/utils/format'
import type { FinancialAttentionItem } from '../types'

const STATUS_BADGE: Record<string, string> = {
  sent:    'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
  partial: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  overdue: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
}

interface FinancialAttentionProps {
  items:    FinancialAttentionItem[]
  loading?: boolean
}

function isOverdue(item: FinancialAttentionItem): boolean {
  if (!item.due_date) return false
  return item.due_date < new Date().toISOString().split('T')[0]
}

export function FinancialAttention({ items, loading = false }: FinancialAttentionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Financial Attention
            </CardTitle>
            <CardDescription>Invoices needing action</CardDescription>
          </div>
          <Link href="/invoices" className="text-xs text-primary hover:underline shrink-0">
            View all invoices →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No invoices require attention.</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/invoices/${item.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.invoice_number}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_BADGE[item.status] ?? ''} ${isOverdue(item) ? STATUS_BADGE.overdue : ''}`}
                    >
                      {isOverdue(item) ? 'overdue' : item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">
                    {formatCurrency(item.balance_due, item.currency)}
                  </p>
                  {item.due_date && (
                    <p className={`text-xs ${isOverdue(item) ? 'text-red-500' : 'text-muted-foreground'}`}>
                      Due {formatDate(item.due_date)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
