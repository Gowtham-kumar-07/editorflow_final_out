'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { TeamWorkloadMember } from '../types'

interface TeamWorkloadWidgetProps {
  members:  TeamWorkloadMember[]
  loading?: boolean
}

export function TeamWorkloadWidget({ members, loading = false }: TeamWorkloadWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Team Workload
            </CardTitle>
            <CardDescription>Active tasks per team member</CardDescription>
          </div>
          <Link href="/team" className="text-xs text-primary hover:underline shrink-0">
            View team →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : members.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active task assignments to show.
          </p>
        ) : (
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.specialization && (
                    <p className="text-xs text-muted-foreground truncate">{m.specialization}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                  <span className="text-foreground" title="Active tasks">{m.active_tasks}</span>
                  <span className="text-violet-500" title="In review">{m.in_review} rev</span>
                  {m.overdue > 0 && (
                    <span className="text-red-500" title="Overdue">{m.overdue} !</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
