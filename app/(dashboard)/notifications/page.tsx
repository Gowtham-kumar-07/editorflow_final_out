'use client'

import { useState }              from 'react'
import { PageContainer }         from '@/components/layout'
import { Button }                from '@/components/ui/button'
import { CheckCheck }            from 'lucide-react'
import { cn }                    from '@/lib/utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks/use-notifications'
import { NotificationList }      from '@/features/notifications/components/notification-list'
import { NotificationSkeleton }  from '@/features/notifications/components/notification-skeleton'

export default function NotificationsPage() {
  const [tab, setTab]   = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useNotifications({
    unread_only: tab === 'unread',
    page,
    pageSize: 20,
  })

  const { mutate: markRead }           = useMarkNotificationRead()
  const { mutate: markAll, isPending } = useMarkAllNotificationsRead()

  const hasUnread = (data?.unread_count ?? 0) > 0

  function handleTabChange(value: string) {
    setTab(value as 'all' | 'unread')
    setPage(1)
  }

  return (
    <PageContainer
      title="Notifications"
      actions={
        hasUnread ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => markAll()}
            disabled={isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="inline-flex rounded-md border bg-muted p-1">
          {(['all', 'unread'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'all' ? 'All' : 'Unread'}
              {t === 'unread' && (data?.unread_count ?? 0) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {Math.min(data!.unread_count, 99)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rounded-md border">
          {isLoading ? (
            <NotificationSkeleton count={8} />
          ) : (
            <NotificationList
              notifications={data?.notifications ?? []}
              onRead={markRead}
              unreadOnly={tab === 'unread'}
            />
          )}
        </div>

        {/* Pagination */}
        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {data?.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
