'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/utils/format'
import type { ReviewQueueItem } from '../types'

interface MyReviewStatusWidgetProps {
  items:    ReviewQueueItem[]
  loading?: boolean
}

export function MyReviewStatusWidget({ items, loading = false }: MyReviewStatusWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-violet-500" />
          Submitted for Review
        </CardTitle>
        <CardDescription>Tasks awaiting manager approval</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks waiting for review right now.
          </p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/tasks/${item.id}`}
                className="flex items-start justify-between gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.project_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded px-1.5 py-0.5">
                    In Review
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(item.updated_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
