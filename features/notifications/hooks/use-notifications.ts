'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationKeys } from '../queries/notification-queries'
import {
  getNotificationsAction,
  getUnreadNotificationCountAction,
  getRecentNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '../actions'
import type { NotificationFilters, Notification } from '../types'

const STALE_COUNT   = 30  * 1000  // unread count — fairly fresh
const STALE_LIST    = 60  * 1000  // full list — slightly longer
const POLL_COUNT    = 60  * 1000  // badge count: drives the notification dot
const POLL_RECENT   = 90  * 1000  // popover list: staggered to avoid simultaneous firing

// ─── Unread count (used by bell badge) ───────────────────────────────────────

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey:        notificationKeys.count(),
    queryFn:         () => getUnreadNotificationCountAction(),
    staleTime:       STALE_COUNT,
    refetchInterval: POLL_COUNT,
  })
}

// ─── Recent notifications (used by bell popover) ──────────────────────────────

export function useRecentNotifications(limit = 10) {
  return useQuery({
    queryKey:        notificationKeys.recent(),
    queryFn:         () => getRecentNotificationsAction(limit),
    staleTime:       STALE_LIST,
    refetchInterval: POLL_RECENT,
  })
}

// ─── Paginated list (used by /notifications page) ─────────────────────────────

export function useNotifications(filters: NotificationFilters = {}) {
  return useQuery({
    queryKey:        notificationKeys.list(filters),
    queryFn:         () => getNotificationsAction(filters),
    staleTime:       STALE_LIST,
    placeholderData: (prev) => prev,
  })
}

// ─── Mark single notification read (optimistic) ───────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationReadAction(notificationId),

    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })

      const prevCount  = queryClient.getQueryData<number>(notificationKeys.count())
      const prevRecent = queryClient.getQueryData<Notification[]>(notificationKeys.recent())

      // Optimistically mark read in recent list
      queryClient.setQueryData<Notification[]>(notificationKeys.recent(), (old) =>
        (old ?? []).map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      )

      // Decrement count
      queryClient.setQueryData<number>(notificationKeys.count(), (old) =>
        Math.max((old ?? 0) - 1, 0)
      )

      return { prevCount, prevRecent }
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prevRecent !== undefined)
        queryClient.setQueryData(notificationKeys.recent(), ctx.prevRecent)
      if (ctx?.prevCount !== undefined)
        queryClient.setQueryData(notificationKeys.count(), ctx.prevCount)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

// ─── Mark all read (optimistic) ───────────────────────────────────────────────

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsReadAction(),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })

      const prevCount  = queryClient.getQueryData<number>(notificationKeys.count())
      const prevRecent = queryClient.getQueryData<Notification[]>(notificationKeys.recent())

      queryClient.setQueryData<Notification[]>(notificationKeys.recent(), (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true }))
      )
      queryClient.setQueryData<number>(notificationKeys.count(), 0)

      return { prevCount, prevRecent }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevRecent !== undefined)
        queryClient.setQueryData(notificationKeys.recent(), ctx.prevRecent)
      if (ctx?.prevCount !== undefined)
        queryClient.setQueryData(notificationKeys.count(), ctx.prevCount)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
