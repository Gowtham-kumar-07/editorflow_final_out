'use client'

import { Bell }                   from 'lucide-react'
import { Button }                 from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationPopover }    from './notification-popover'
import { useUnreadNotificationCount } from '../hooks/use-notifications'
import { cn }                     from '@/lib/utils'

export function NotificationBell() {
  const { data: count = 0 } = useUnreadNotificationCount()
  const capped = Math.min(count, 99)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {capped > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground',
                capped > 9 && 'min-w-5'
              )}
              aria-label={`${capped} unread notifications`}
            >
              {capped > 99 ? '99+' : capped}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="p-0">
        <NotificationPopover />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
