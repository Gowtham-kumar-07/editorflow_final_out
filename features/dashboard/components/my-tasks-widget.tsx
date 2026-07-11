'use client'

import Link from 'next/link'
import { ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/utils/format'
import type { MyTaskItem } from '../types'

const STATUS_STYLE: Record<string, string> = {
  todo:        'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
  in_progress: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  blocked:     'text-red-700 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  review:      'text-violet-700 bg-violet-50 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800',
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  review:      'In Review',
}

const PRIORITY_LABEL: Record<string, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
}

interface MyTasksWidgetProps {
  items:    MyTaskItem[]
  loading?: boolean
}

export function MyTasksWidget({ items, loading = false }: MyTasksWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              My Tasks
            </CardTitle>
            <CardDescription>Your assigned active tasks</CardDescription>
          </div>
          <Link href="/tasks" className="text-xs text-primary hover:underline shrink-0">
            View all my tasks →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active tasks assigned to you.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/tasks/${item.id}`}
                className="flex items-start justify-between gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    {item.is_overdue && (
                      <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 dark:border-red-800">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.project_name}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <Badge variant="outline" className={`text-[10px] block ${STATUS_STYLE[item.status] ?? ''}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                  {item.due_date && (
                    <p className={`text-xs ${item.is_overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {formatDate(item.due_date)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {PRIORITY_LABEL[item.priority] ?? item.priority}
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
