'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { navItems, bottomNavItems, type NavItem } from '@/lib/navigation'
import { useOrganizationContext } from '@/components/providers/organization-provider'
import { APP_NAME } from '@/lib/constants'

type SidebarProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const linkEl = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
        'transition-all duration-150 ease-out',
        'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
        collapsed && 'justify-center px-2',
      )}
    >
      {/* Active left indicator */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-150', isActive && 'scale-110')} />
      {!collapsed && (
        <span className={cn('transition-opacity duration-150', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
          {item.title}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
      </Tooltip>
    )
  }

  return linkEl
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { organization } = useOrganizationContext()
  const role = organization?.role ?? 'member'

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-sidebar',
          'transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 min-w-0">
            <Zap className="h-5 w-5 shrink-0 text-primary" />
            <span
              className={cn(
                'text-base font-bold text-sidebar-foreground truncate',
                'transition-all duration-200 ease-in-out',
                collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100',
              )}
            >
              {APP_NAME}
            </span>
          </Link>
        </div>

        {/* Main nav */}
        <ScrollArea className="flex-1 py-3">
          <nav className="flex flex-col gap-0.5 px-2">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom nav */}
        <div className="py-3">
          <Separator className="mb-3" />
          <nav className="flex flex-col gap-0.5 px-2">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  )
}
