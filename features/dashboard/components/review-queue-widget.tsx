'use client'

import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/utils/format'
import type { ReviewQueueItem } from '../types'

interface ReviewQueueWidgetProps {
  items:    ReviewQueueItem[]
  loading?: boolean
  maxItems?: number
}

export function ReviewQueueWidget({ items, loading = false, maxItems = 5 }: ReviewQueueWidgetProps) {
  const shown = items.slice(0, maxItems)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-violet-500" />
              Tasks in Review
            </CardTitle>
            <CardDescription>Awaiting approval</CardDescription>
          </div>
          <Link href="/tasks?status=review" className="text-xs text-primary hover:underline shrink-0">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No tasks waiting for review.</p>
        ) : (
          <div className="divide-y">
            {shown.map((item) => (
              <Link
                key={item.id}
                href={`/tasks/${item.id}`}
                className="flex items-start justify-between gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{item.project_name}</span>
                    {item.assignee_name && (
                      <>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-xs text-muted-foreground truncate">{item.assignee_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {formatRelativeTime(item.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
