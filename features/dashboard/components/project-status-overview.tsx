'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProjectStatusCount } from '../types'
import type { ProjectStatus } from '@/types/supabase'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft:     'Draft',
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  review:    'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived:  'Archived',
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft:     'bg-slate-400',
  planning:  'bg-sky-500',
  active:    'bg-emerald-500',
  on_hold:   'bg-amber-500',
  review:    'bg-violet-500',
  completed: 'bg-teal-500',
  cancelled: 'bg-rose-500',
  archived:  'bg-slate-300',
}

interface ProjectStatusOverviewProps {
  data:     ProjectStatusCount[]
  loading?: boolean
}

export function ProjectStatusOverview({ data, loading = false }: ProjectStatusOverviewProps) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Project Status</CardTitle>
        <CardDescription>Distribution across {total} projects</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="space-y-3">
            {data.map(({ status, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLOR[status as ProjectStatus] ?? 'bg-muted'}`} />
                      {STATUS_LABEL[status as ProjectStatus] ?? status}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${STATUS_COLOR[status as ProjectStatus] ?? 'bg-primary'} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
