'use client'

import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatRelativeTime } from '@/utils/format'
import { useProjectActivity } from '../../hooks/use-project-workspace'
import { ActivitySkeleton } from './skeletons'
import type { ActivityType } from '../../types/workspace'

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  created:         'created this',
  updated:         'updated this',
  deleted:         'deleted this',
  commented:       'left a comment',
  assigned:        'was assigned',
  uploaded:        'uploaded a file',
  completed:       'marked as completed',
  payment_received: 'received a payment',
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProjectActivityCard({ projectId }: { projectId: string }) {
  const { data: result, isPending } = useProjectActivity(projectId)

  if (isPending) return <ActivitySkeleton />

  const items = result?.ok ? result.data : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                  {item.user?.avatar_url && (
                    <AvatarImage src={item.user.avatar_url} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {initials(item.user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
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
