'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'

interface DashboardKpiCardProps {
  title:      string
  value:      number
  icon:       LucideIcon
  href?:      string
  isCurrency?: boolean
  currency?:  string
  colorClass?: string
  loading?:   boolean
}

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  href,
  isCurrency = false,
  currency   = 'USD',
  colorClass = 'text-muted-foreground',
  loading    = false,
}: DashboardKpiCardProps) {
  const displayValue = isCurrency
    ? formatCurrency(value, currency)
    : value.toLocaleString()

  const inner = (
    <Card className={href ? 'transition-colors hover:bg-muted/30 cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-md bg-muted p-1.5 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-28 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <div className="text-3xl font-bold tracking-tight">{displayValue}</div>
        )}
      </CardContent>
    </Card>
  )

  if (href && !loading) return <Link href={href}>{inner}</Link>
  return inner
}
