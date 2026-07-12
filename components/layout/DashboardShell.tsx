'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { GlobalSearchProvider } from '@/features/global-search/context/global-search-context'
import { GlobalSearchDialog }   from '@/features/global-search/components/global-search-dialog'
import { Sidebar }        from './sidebar'
import { Header }         from './header'
import { PageTransition } from './page-transition'
import type { ShellUser } from './UserMenu'

export type { ShellUser }

type DashboardShellProps = {
  children: ReactNode
  user: ShellUser
  orgName: string
}

export function DashboardShell({ children, user, orgName }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <GlobalSearchProvider userId={user.id}>
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile slide-over sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar (hidden below md) */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Main area */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onToggleMobileSidebar={() => setMobileSidebarOpen((o) => !o)}
          user={user}
          orgName={orgName}
        />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
    <GlobalSearchDialog />
    </GlobalSearchProvider>
  )
}
