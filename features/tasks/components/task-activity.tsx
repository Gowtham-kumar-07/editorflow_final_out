'use client'

import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/utils/format'
import { useTaskActivity } from '../hooks/use-tasks'
import type { ActivityType } from '../types'

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  created:          'created this task',
  updated:          'updated this task',
  deleted:          'archived this task',
  commented:        'left a comment',
  assigned:         'was assigned',
  uploaded:         'uploaded a file',
  completed:        'marked as completed',
  payment_received: 'received a payment',
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="mt-0.5 h-6 w-6 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data: result, isPending } = useTaskActivity(taskId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <ActivitySkeleton />
        ) : !result?.ok || result.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-4">
            {result.data.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                  {item.user?.avatar_url && <AvatarImage src={item.user.avatar_url} />}
                  <AvatarFallback className="text-[10px]">
                    {initials(item.user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {item.user?.full_name ?? 'Someone'}
                    </span>{' '}
                    {ACTIVITY_LABEL[item.activity_type] ?? item.activity_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
