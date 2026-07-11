'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/utils/format'
import type { DashboardActivityItem } from '../types'
import type { ActivityType } from '@/types/supabase'

const ACTION_LABEL: Record<string, string> = {
  task_started:          'started',
  submitted_for_review:  'submitted for review',
  task_approved:         'approved',
  revision_requested:    'requested revision on',
  task_reopened:         'reopened',
  status_changed:        'updated status of',
}

const ACTIVITY_LABEL: Partial<Record<ActivityType, string>> = {
  created:          'created',
  updated:          'updated',
  deleted:          'deleted',
  commented:        'commented on',
  assigned:         'assigned',
  uploaded:         'uploaded to',
  completed:        'completed',
  payment_received: 'recorded payment for',
}

function buildActivityText(item: DashboardActivityItem): string {
  const who    = item.user_name ?? 'Someone'
  const what   = item.entity_title ? `"${item.entity_title}"` : `a ${item.entity_type}`
  const action = item.action
    ? (ACTION_LABEL[item.action] ?? item.action)
    : (ACTIVITY_LABEL[item.activity_type] ?? item.activity_type)

  return `${who} ${action} ${what}`
}

function getEntityHref(item: DashboardActivityItem): string | null {
  if (item.entity_type === 'task')    return `/tasks/${item.entity_id}`
  if (item.entity_type === 'project') return `/projects/${item.entity_id}`
  if (item.entity_type === 'invoice') return `/invoices/${item.entity_id}`
  return null
}

interface RecentActivityWidgetProps {
  items:    DashboardActivityItem[]
  loading?: boolean
}

export function RecentActivityWidget({ items, loading = false }: RecentActivityWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest actions in your organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Activity will appear here as your team works on projects.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const href = getEntityHref(item)
              const text = buildActivityText(item)
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                  <div className="min-w-0">
                    {href ? (
                      <Link href={href} className="text-sm hover:underline text-foreground/90 leading-snug">
                        {text}
                      </Link>
                    ) : (
                      <p className="text-sm text-foreground/90 leading-snug">{text}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(item.created_at)}
                    </p>
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
