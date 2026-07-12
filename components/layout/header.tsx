'use client'

import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeToggle } from '@/hooks/use-theme-toggle'
import { useGlobalSearch } from '@/features/global-search/context/global-search-context'
import { Breadcrumbs } from './Breadcrumbs'
import { UserMenu } from './UserMenu'
import { OrganizationSwitcher } from './OrganizationSwitcher'
import { NotificationBell } from '@/features/notifications/components'
import type { ShellUser } from './UserMenu'

type HeaderProps = {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onToggleMobileSidebar: () => void
  user: ShellUser
  orgName: string
}

export function Header({
  sidebarCollapsed,
  onToggleSidebar,
  onToggleMobileSidebar,
  user,
  orgName,
}: HeaderProps) {
  const { resolvedTheme, toggle, mounted } = useThemeToggle()
  const { open: openSearch } = useGlobalSearch()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 gap-4">
      {/* Left — sidebar controls + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger (mobile only) */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onToggleMobileSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Panel toggle (desktop only) */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 md:flex"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>

        <Breadcrumbs />
      </div>

      {/* Right — actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Search trigger — desktop text button */}
        <Button
          variant="outline"
          className="hidden h-9 w-44 justify-start gap-2 text-sm text-muted-foreground sm:flex lg:w-64"
          aria-label="Search (Ctrl+K)"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
          <span>Search…</span>
          <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium lg:block">
            ⌘K
          </kbd>
        </Button>

        {/* Search trigger — mobile icon button */}
        <Button
          variant="ghost"
          size="icon"
          className="flex sm:hidden"
          aria-label="Search"
          onClick={openSearch}
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {/*
           * Render Moon as placeholder until mount so server and initial client
           * render produce the same HTML — prevents hydration mismatch.
           */}
          {mounted && resolvedTheme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* Notification bell */}
        <NotificationBell />

        <OrganizationSwitcher />

        <UserMenu user={user} orgName={orgName} />
      </div>
    </header>
  )
}
