'use client'

import { useEffect, useRef, useState } from 'react'
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
  index?:     number
}

function useCountUp(target: number, enabled: boolean) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (!enabled) { setDisplay(target); return }
    // Skip count-up on minor refetch updates — only animate on first mount
    // (prevTarget starts as target on first render, so this detects subsequent changes)
    const isFirstMount = startRef.current === null && display === 0
    if (!isFirstMount && prevTarget.current === target) return
    prevTarget.current = target

    const duration = Math.min(900, Math.max(400, target * 0.5))
    const from = isFirstMount ? 0 : display
    const diff = target - from
    if (diff === 0) return

    const start = performance.now()
    startRef.current = start

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + diff * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled])

  return display
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
  index      = 0,
}: DashboardKpiCardProps) {
  const animated = useCountUp(value, !loading && !isCurrency)
  const displayValue = isCurrency
    ? formatCurrency(value, currency)
    : animated.toLocaleString()

  const staggerDelay = `${index * 60}ms`

  const inner = (
    <Card
      style={{ animationDelay: staggerDelay }}
      className={[
        'page-transition',
        href ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200' : '',
      ].join(' ').trim()}
    >
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
          <div className="text-3xl font-bold tracking-tight tabular-nums">{displayValue}</div>
        )}
      </CardContent>
    </Card>
  )

  if (href && !loading) return <Link href={href}>{inner}</Link>
  return inner
}
