'use client'

import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/utils/format'
import type { UpcomingDeadlineItem } from '../types'

function relativeDue(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Tomorrow'
  return `in ${diff} day${diff === 1 ? '' : 's'}`
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  review:      'In Review',
}

interface UpcomingDeadlinesWidgetProps {
  items:    UpcomingDeadlineItem[]
  loading?: boolean
}

export function UpcomingDeadlinesWidget({ items, loading = false }: UpcomingDeadlinesWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-500" />
          Upcoming Deadlines
        </CardTitle>
        <CardDescription>Tasks due in the next 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No upcoming deadlines.</p>
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
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground truncate">{item.project_name}</span>
                    {item.assignee_name && (
                      <>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-xs text-muted-foreground">{item.assignee_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${item.is_overdue ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.is_overdue ? 'Overdue' : formatDate(item.due_date)}
                  </p>
                  {!item.is_overdue && (
                    <p className="text-xs text-muted-foreground">{relativeDue(item.due_date)}</p>
                  )}
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
