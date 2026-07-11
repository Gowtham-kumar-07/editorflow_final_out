'use client'

import {
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  UserPlus,
  Upload,
  CheckCircle,
  DollarSign,
  Activity,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientActivity } from '../hooks/use-client-detail'
import { formatRelativeTime } from '@/utils/format'
import type { ActivityType } from '../types'

// ─── Activity config ──────────────────────────────────────────────────────────

type ActivityConfig = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
}

const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  created:          { icon: Plus,          label: 'Created',         color: 'bg-green-500'   },
  updated:          { icon: Edit2,         label: 'Updated',         color: 'bg-blue-500'    },
  deleted:          { icon: Trash2,        label: 'Archived',        color: 'bg-red-500'     },
  commented:        { icon: MessageSquare, label: 'Commented',       color: 'bg-purple-500'  },
  assigned:         { icon: UserPlus,      label: 'Assigned',        color: 'bg-amber-500'   },
  uploaded:         { icon: Upload,        label: 'Uploaded',        color: 'bg-teal-500'    },
  completed:        { icon: CheckCircle,   label: 'Completed',       color: 'bg-green-600'   },
  payment_received: { icon: DollarSign,    label: 'Payment received', color: 'bg-emerald-500' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Helper: extract summary label from metadata ───────────────────────────────

function metaSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as Record<string, unknown>
  if (typeof m.company_name === 'string') return m.company_name
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientActivityCard({ clientId }: { clientId: string }) {
  const { data: activities, isLoading, isError } = useClientActivity(clientId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <ActivitySkeleton />}

        {isError && (
          <p className="text-sm text-destructive">Failed to load activity.</p>
        )}

        {!isLoading && !isError && activities?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Changes to this client will appear here.
            </p>
          </div>
        )}

        {!isLoading && !isError && activities && activities.length > 0 && (
          <div className="relative space-y-4">
            {/* vertical connecting line */}
            <div className="absolute bottom-3 left-3.5 top-3 w-px bg-border" />

            {activities.map((activity) => {
              const cfg = ACTIVITY_CONFIG[activity.activity_type]
              const Icon = cfg.icon
              const summary = metaSummary(activity.metadata)

              return (
                <div key={activity.id} className="relative flex gap-3">
                  <div
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.color}`}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-sm">
                      <span className="font-medium">{cfg.label}</span>
                      {summary && (
                        <span className="text-muted-foreground"> · {summary}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(activity.created_at)}
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
