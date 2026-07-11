'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'
import type { LucideIcon } from 'lucide-react'

interface ReportKpiCardProps {
  title:      string
  value:      number | null | undefined
  icon:       LucideIcon
  isCurrency?: boolean
  currency?:   string
  suffix?:     string
  colorClass?: string
  loading?:    boolean
  note?:       string
}

export function ReportKpiCard({
  title,
  value,
  icon:  Icon,
  isCurrency = false,
  currency   = 'USD',
  suffix,
  colorClass = 'text-foreground',
  loading    = false,
  note,
}: ReportKpiCardProps) {
  function display(): string {
    if (value === null || value === undefined) return '—'
    if (isCurrency) return formatCurrency(value, currency)
    const formatted = new Intl.NumberFormat('en-US').format(value)
    return suffix ? `${formatted}${suffix}` : formatted
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
        <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className={`mt-2 text-2xl font-bold tabular-nums ${colorClass}`}>{display()}</p>
      )}
      {note && (
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  )
}
