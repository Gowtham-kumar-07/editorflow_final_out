'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { GlobalSearchProvider, useGlobalSearch } from '@/features/global-search/context/global-search-context'
import { GlobalSearchDialog }   from '@/features/global-search/components/global-search-dialog'
import { Sidebar }        from './sidebar'
import { Header }         from './header'
import { PageTransition } from './page-transition'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useAndroidBack }       from '@/hooks/use-android-back'
import { OfflineBanner }        from '@/components/mobile/offline-banner'
import type { ShellUser } from './UserMenu'

// Must be rendered inside GlobalSearchProvider so it can access the context.
function AndroidBackHandler() {
  const { isOpen, close } = useGlobalSearch()
  useAndroidBack(isOpen, close)
  return null
}

export type { ShellUser }

type DashboardShellProps = {
  children: ReactNode
  user: ShellUser
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  useKeyboardShortcuts()

  return (
    <GlobalSearchProvider userId={user.id}>
      {/* Handles Android hardware back button — must be inside the provider */}
      <AndroidBackHandler />

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
          />
          {/* Non-intrusive offline indicator — hidden when online */}
          <OfflineBanner />
          <main
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <GlobalSearchDialog />
    </GlobalSearchProvider>
  )
}
