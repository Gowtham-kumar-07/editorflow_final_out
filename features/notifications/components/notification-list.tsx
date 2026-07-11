'use client'

import { NotificationItem }       from './notification-item'
import { NotificationEmptyState } from './notification-empty-state'
import type { Notification }      from '../types'

interface Props {
  notifications: Notification[]
  onRead:        (id: string) => void
  unreadOnly?:   boolean
}

export function NotificationList({ notifications, onRead, unreadOnly }: Props) {
  if (notifications.length === 0) {
    return <NotificationEmptyState unreadOnly={unreadOnly} />
  }

  return (
    <div className="divide-y">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onRead={onRead} />
      ))}
    </div>
  )
}
