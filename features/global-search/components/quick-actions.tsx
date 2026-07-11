'use client'

import { useRouter } from 'next/navigation'
import { Users, FolderOpen, CheckSquare, FileText, Bell } from 'lucide-react'
import { CommandGroup, CommandItem } from '@/components/ui/command'
import type { OrgRole } from '@/types/supabase'

interface QuickAction {
  label:    string
  Icon:     React.ComponentType<{ className?: string }>
  href:     string
}

const MANAGER_ACTIONS: QuickAction[] = [
  { label: 'New Client',  Icon: Users,       href: '/clients/new'  },
  { label: 'New Project', Icon: FolderOpen,  href: '/projects/new' },
  { label: 'New Task',    Icon: CheckSquare, href: '/tasks/new'    },
  { label: 'New Invoice', Icon: FileText,    href: '/invoices/new' },
]

const PM_ACTIONS: QuickAction[] = [
  { label: 'New Project', Icon: FolderOpen,  href: '/projects/new' },
  { label: 'New Task',    Icon: CheckSquare, href: '/tasks/new'    },
  { label: 'New Client',  Icon: Users,       href: '/clients/new'  },
]

const MEMBER_ACTIONS: QuickAction[] = [
  { label: 'My Tasks',      Icon: CheckSquare, href: '/tasks'         },
  { label: 'Projects',      Icon: FolderOpen,  href: '/projects'      },
  { label: 'Notifications', Icon: Bell,        href: '/notifications' },
]

function getActions(role: OrgRole | undefined): QuickAction[] {
  if (!role) return []
  if (role === 'owner' || role === 'admin') return MANAGER_ACTIONS
  if (role === 'project_manager')           return PM_ACTIONS
  return MEMBER_ACTIONS
}

interface QuickActionsProps {
  role?:     OrgRole
  onSelect?: () => void
}

export function QuickActions({ role, onSelect }: QuickActionsProps) {
  const router = useRouter()
  const actions = getActions(role)
  if (actions.length === 0) return null

  return (
    <CommandGroup heading="Quick Actions">
      {actions.map((action) => (
        <CommandItem
          key={action.href}
          value={`quick:${action.href}`}
          onSelect={() => {
            router.push(action.href)
            onSelect?.()
          }}
          className="flex items-center gap-3 px-3 py-2"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <action.Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm">{action.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
