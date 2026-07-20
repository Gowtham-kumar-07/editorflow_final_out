'use client'

import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderOpen, CheckSquare, FileText,
  CreditCard, BarChart2, Settings, UserCircle, Bell,
  PlusCircle,
} from 'lucide-react'
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command'
import type { OrgRole } from '@/types/supabase'

interface QuickAction {
  label:     string
  shortcut?: string
  Icon:      React.ComponentType<{ className?: string }>
  href:      string
}

// Navigation commands — visible to every authenticated user
const NAV_ACTIONS: QuickAction[] = [
  { label: 'Dashboard', shortcut: 'G D', Icon: LayoutDashboard, href: '/dashboard'      },
  { label: 'Clients',   shortcut: 'G C', Icon: Users,           href: '/clients'        },
  { label: 'Projects',  shortcut: 'G P', Icon: FolderOpen,      href: '/projects'       },
  { label: 'Tasks',     shortcut: 'G T', Icon: CheckSquare,     href: '/tasks'          },
  { label: 'Invoices',               Icon: FileText,         href: '/invoices'       },
  { label: 'Payments',               Icon: CreditCard,       href: '/payments'       },
  { label: 'Reports',                Icon: BarChart2,        href: '/reports'        },
  { label: 'Team',                   Icon: UserCircle,       href: '/team'           },
  { label: 'Notifications',          Icon: Bell,             href: '/notifications'  },
  { label: 'Settings',               Icon: Settings,         href: '/settings'       },
]

// Create commands — role-gated
const MANAGER_CREATE: QuickAction[] = [
  { label: 'Create Client',  Icon: PlusCircle, href: '/clients/new'  },
  { label: 'Create Project', Icon: PlusCircle, href: '/projects/new' },
  { label: 'Create Task',    Icon: PlusCircle, href: '/tasks/new'    },
  { label: 'Create Invoice', Icon: PlusCircle, href: '/invoices/new' },
]

const PM_CREATE: QuickAction[] = [
  { label: 'Create Project', Icon: PlusCircle, href: '/projects/new' },
  { label: 'Create Task',    Icon: PlusCircle, href: '/tasks/new'    },
  { label: 'Create Client',  Icon: PlusCircle, href: '/clients/new'  },
]

const MEMBER_CREATE: QuickAction[] = [
  { label: 'Create Task', Icon: PlusCircle, href: '/tasks/new' },
]

function getCreateActions(role: OrgRole | undefined): QuickAction[] {
  if (!role) return []
  if (role === 'owner' || role === 'admin') return MANAGER_CREATE
  if (role === 'project_manager')           return PM_CREATE
  return MEMBER_CREATE
}

interface QuickActionsProps {
  role?:     OrgRole
  onSelect?: () => void
}

function ActionItem({ action, onSelect, router }: {
  action:   QuickAction
  onSelect: () => void
  router:   ReturnType<typeof useRouter>
}) {
  return (
    <CommandItem
      key={action.href}
      value={`action:${action.label.toLowerCase()}`}
      onSelect={() => { router.push(action.href); onSelect() }}
      className="flex items-center gap-3 px-3 py-2"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <action.Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm">{action.label}</span>
      {action.shortcut && (
        <span className="text-[10px] text-muted-foreground/60 font-mono tracking-wider">
          {action.shortcut}
        </span>
      )}
    </CommandItem>
  )
}

export function QuickActions({ role, onSelect }: QuickActionsProps) {
  const router        = useRouter()
  const createActions = getCreateActions(role)
  const close         = () => onSelect?.()

  if (!role) return null

  return (
    <>
      <CommandGroup heading="Go to">
        {NAV_ACTIONS.map((action) => (
          <ActionItem key={action.href} action={action} onSelect={close} router={router} />
        ))}
      </CommandGroup>

      {createActions.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading="Create">
            {createActions.map((action) => (
              <ActionItem key={action.href} action={action} onSelect={close} router={router} />
            ))}
          </CommandGroup>
        </>
      )}
    </>
  )
}
