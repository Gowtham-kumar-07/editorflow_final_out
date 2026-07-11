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

// Defined at module level so the React Compiler never conflates instances
// across map iterations — avoids memoization issues when passed to .map().
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
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    )
  }

  return linkEl
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname     = usePathname()
  const { organization } = useOrganizationContext()
  const role = organization?.role ?? 'member'

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-sidebar transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b px-4',
            collapsed && 'justify-center',
          )}
        >
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
            <Zap className="h-6 w-6 shrink-0 text-primary" />
            {!collapsed && (
              <span className="text-lg font-bold text-sidebar-foreground">{APP_NAME}</span>
            )}
          </Link>
        </div>

        {/* Main nav */}
        <ScrollArea className="flex-1 py-4">
          <nav className="flex flex-col gap-1 px-2">
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
        <div className="py-4">
          <Separator className="mb-4" />
          <nav className="flex flex-col gap-1 px-2">
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
