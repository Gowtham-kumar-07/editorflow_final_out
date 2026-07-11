'use client'

import { Bell } from 'lucide-react'

interface Props {
  unreadOnly?: boolean
}

export function NotificationEmptyState({ unreadOnly }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
        </p>
        <p className="text-xs text-muted-foreground">
          {unreadOnly
            ? "You're all caught up."
            : 'Activity from your projects, invoices, and team will appear here.'}
        </p>
      </div>
    </div>
  )
}
