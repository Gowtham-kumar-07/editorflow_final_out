'use client'

import { DollarSign, TrendingUp, Clock, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'
import type { PaymentSummaryMetrics } from '../types'

interface SummaryCardProps {
  title:    string
  value:    string | number
  icon:     React.ReactNode
  sub?:     string
  currency?: string
}

function SummaryCard({ title, value, icon, sub, currency }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {currency ? formatCurrency(value as number, currency) : value}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

interface PaymentSummaryGridProps {
  metrics?: PaymentSummaryMetrics
  loading?: boolean
}

export function PaymentSummaryGrid({ metrics, loading }: PaymentSummaryGridProps) {
  if (loading || !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="Total Collected"
        value={metrics.total_collected}
        icon={<DollarSign className="h-4 w-4" />}
        currency={metrics.base_currency}
        sub="All completed payments"
      />
      <SummaryCard
        title="Collected This Month"
        value={metrics.collected_this_month}
        icon={<TrendingUp className="h-4 w-4" />}
        currency={metrics.base_currency}
        sub="This calendar month"
      />
      <SummaryCard
        title="Outstanding Balance"
        value={metrics.outstanding_balance}
        icon={<Clock className="h-4 w-4" />}
        currency={metrics.base_currency}
        sub="Across open invoices"
      />
      <SummaryCard
        title="Payments This Month"
        value={metrics.payments_this_month}
        icon={<Activity className="h-4 w-4" />}
        sub="Completed transactions"
      />
    </div>
  )
}
