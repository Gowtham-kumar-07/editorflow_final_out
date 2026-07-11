'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils/format'
import type { RevenueTrendMonth } from '../types'

interface RevenueOverviewChartProps {
  data:     RevenueTrendMonth[]
  loading?: boolean
}

export function RevenueOverviewChart({ data, loading = false }: RevenueOverviewChartProps) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null)

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue Overview</CardTitle>
          <CardDescription>Last 6 months of collected payments</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  const hasData = data.some((d) => d.amount > 0)

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue Overview</CardTitle>
          <CardDescription>Last 6 months of collected payments</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">No payments recorded in this period.</p>
        </CardContent>
      </Card>
    )
  }

  const max     = Math.max(...data.map((d) => d.amount), 1)
  const WIDTH   = 540
  const HEIGHT  = 160
  const PADDING = { top: 12, right: 8, bottom: 32, left: 8 }
  const chartW  = WIDTH  - PADDING.left - PADDING.right
  const chartH  = HEIGHT - PADDING.top  - PADDING.bottom
  const n       = data.length
  const barGap  = 8
  const barW    = (chartW - (n - 1) * barGap) / n

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Revenue Overview</CardTitle>
        <CardDescription>Last 6 months of collected payments</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ maxHeight: 180 }}
          onMouseLeave={() => setTooltip(null)}
        >
          {data.map((d, i) => {
            const barHeight = (d.amount / max) * chartH
            const x = PADDING.left + i * (barW + barGap)
            const y = PADDING.top + chartH - barHeight
            const cx = x + barW / 2

            return (
              <g key={d.month}>
                {/* Bar */}
                <rect
                  x={x} y={y}
                  width={barW} height={barHeight}
                  rx={3}
                  className="fill-primary opacity-80 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => {
                    const svgRect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                    setTooltip({ idx: i, x: e.clientX - svgRect.left, y: e.clientY - svgRect.top })
                  }}
                />
                {/* Month label */}
                <text
                  x={cx}
                  y={PADDING.top + chartH + 18}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10, fontFamily: 'inherit' }}
                >
                  {d.month.split(' ')[0]}
                </text>
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltip !== null && (() => {
            const d = data[tooltip.idx]
            const tW = 110
            const tH = 36
            const tx = Math.min(Math.max(tooltip.x - tW / 2, 0), WIDTH - tW)
            const ty = Math.max(tooltip.y - tH - 8, 0)
            return (
              <g>
                <rect x={tx} y={ty} width={tW} height={tH} rx={4}
                  className="fill-popover stroke-border" strokeWidth={1} />
                <text x={tx + tW / 2} y={ty + 13} textAnchor="middle"
                  className="fill-popover-foreground" style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 500 }}>
                  {d.month}
                </text>
                <text x={tx + tW / 2} y={ty + 28} textAnchor="middle"
                  className="fill-primary" style={{ fontSize: 11, fontFamily: 'inherit', fontWeight: 700 }}>
                  {formatCurrency(d.amount)}
                </text>
              </g>
            )
          })()}
        </svg>
      </CardContent>
    </Card>
  )
}
