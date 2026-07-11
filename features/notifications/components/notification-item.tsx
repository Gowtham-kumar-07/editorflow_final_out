'use client'

import { useRouter }         from 'next/navigation'
import {
  CheckSquare,
  FolderOpen,
  FileText,
  CreditCard,
  Users,
  Bell,
  AlertCircle,
  XCircle,
  UserCheck,
} from 'lucide-react'
import { cn }                from '@/lib/utils'
import { isSafeRedirect }   from '@/lib/safe-redirect'
import type { Notification, NotificationType } from '../types'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  notification: Notification
  onRead:       (id: string) => void
  compact?:     boolean
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const cls = 'h-4 w-4'
  switch (type) {
    case 'task_assigned':
    case 'task_submitted_for_review':
    case 'task_revision_requested':
    case 'task_approved':
    case 'task_reopened':
      return <CheckSquare className={cls} />
    case 'project_assigned':
    case 'project_status_changed':
      return <FolderOpen className={cls} />
    case 'invoice_sent':
      return <FileText className={cls} />
    case 'invoice_overdue':
      return <AlertCircle className={cls} />
    case 'payment_received':
      return <CreditCard className={cls} />
    case 'payment_voided':
      return <XCircle className={cls} />
    case 'team_invitation_accepted':
    case 'member_role_changed':
    case 'member_specialization_changed':
      return <Users className={cls} />
    case 'member_reactivated':
      return <UserCheck className={cls} />
    default:
      return <Bell className={cls} />
  }
}

function iconBackground(type: NotificationType): string {
  switch (type) {
    case 'task_assigned':
    case 'task_submitted_for_review':
    case 'task_revision_requested':
    case 'task_approved':
    case 'task_reopened':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    case 'project_assigned':
    case 'project_status_changed':
      return 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
    case 'invoice_sent':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
    case 'invoice_overdue':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    case 'payment_received':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
    case 'payment_voided':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
    case 'team_invitation_accepted':
    case 'member_role_changed':
    case 'member_specialization_changed':
      return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
    case 'member_reactivated':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function NotificationItem({ notification, onRead, compact }: Props) {
  const router = useRouter()

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id)
    }
    if (notification.link && isSafeRedirect(notification.link)) {
      router.push(notification.link)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        !notification.is_read && 'bg-primary/5',
        compact && 'py-2'
      )}
    >
      {/* Unread dot */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            iconBackground(notification.type)
          )}
        >
          <NotificationIcon type={notification.type} />
        </div>
        {!notification.is_read && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', compact && 'text-xs')}>
          {notification.title}
        </p>
        <p className={cn('mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2', compact && 'line-clamp-1')}>
          {notification.body}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {relativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  )
}
