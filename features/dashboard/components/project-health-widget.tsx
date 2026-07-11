'use client'

import Link from 'next/link'
import { Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProjectHealthItem } from '../types'
import type { ProjectStatus } from '@/types/supabase'

const STATUS_BADGE: Partial<Record<ProjectStatus, string>> = {
  planning:  'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  review:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800',
  completed: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800',
}

const STATUS_LABEL: Partial<Record<ProjectStatus, string>> = {
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  review:    'In Review',
  completed: 'Completed',
}

interface ProjectHealthWidgetProps {
  items:    ProjectHealthItem[]
  loading?: boolean
}

export function ProjectHealthWidget({ items, loading = false }: ProjectHealthWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Project Health
            </CardTitle>
            <CardDescription>Active projects at a glance</CardDescription>
          </div>
          <Link href="/projects" className="text-xs text-primary hover:underline shrink-0">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active projects.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="block py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.client_name && (
                      <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[item.status] ?? ''}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-8 text-right">{item.progress}%</span>
                </div>
                {/* Task counts */}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{item.open_tasks} open</span>
                  {item.review_tasks > 0 && (
                    <span className="text-violet-500">{item.review_tasks} review</span>
                  )}
                  {item.overdue_tasks > 0 && (
                    <span className="text-red-500">{item.overdue_tasks} overdue</span>
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
