'use client'

import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { AssignedProjectItem } from '../types'
import type { ProjectStatus } from '@/types/supabase'

const STATUS_STYLE: Partial<Record<ProjectStatus, string>> = {
  planning:  'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400',
  review:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400',
  completed: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400',
}

const STATUS_LABEL: Partial<Record<ProjectStatus, string>> = {
  planning: 'Planning', active: 'Active', on_hold: 'On Hold', review: 'Review', completed: 'Done',
}

interface AssignedProjectsWidgetProps {
  items:    AssignedProjectItem[]
  loading?: boolean
}

export function AssignedProjectsWidget({ items, loading = false }: AssignedProjectsWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          My Projects
        </CardTitle>
        <CardDescription>Projects with your active tasks</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No projects with active tasks.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="block py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLE[item.status] ?? ''}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{item.progress}%</span>
                  <span className="text-xs text-muted-foreground">{item.my_tasks} task{item.my_tasks !== 1 ? 's' : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
