'use client'

import Link                   from 'next/link'
import { CheckCheck }         from 'lucide-react'
import { Button }             from '@/components/ui/button'
import { ScrollArea }         from '@/components/ui/scroll-area'
import { Separator }          from '@/components/ui/separator'
import { NotificationItem }   from './notification-item'
import { NotificationSkeleton }    from './notification-skeleton'
import { NotificationEmptyState }  from './notification-empty-state'
import {
  useRecentNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/use-notifications'

export function NotificationPopover() {
  const { data: notifications, isLoading } = useRecentNotifications(10)
  const { mutate: markRead }               = useMarkNotificationRead()
  const { mutate: markAll, isPending }     = useMarkAllNotificationsRead()

  const hasUnread = (notifications ?? []).some((n) => !n.is_read)

  return (
    <div className="flex w-[min(320px,calc(100vw-1rem))] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">Notifications</p>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => markAll()}
            disabled={isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[420px]">
        {isLoading ? (
          <NotificationSkeleton count={4} />
        ) : !notifications?.length ? (
          <NotificationEmptyState />
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markRead}
                compact
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="px-4 py-2">
        <Link
          href="/notifications"
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all notifications
        </Link>
      </div>
    </div>
  )
}
