import type { LucideIcon } from 'lucide-react'
import type { OrgRole } from '@/types/supabase'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  UsersRound,
  CalendarDays,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  Wallet,
} from 'lucide-react'

export type NavItem = {
  title:  string
  href:   string
  icon:   LucideIcon
  roles?: OrgRole[]
}

const MANAGER_ROLES: OrgRole[] = ['owner', 'admin', 'project_manager']

/** Primary navigation — shown in the main sidebar scroll area. */
export const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },

  // Manager-only routes
  { title: 'Clients',   href: '/clients',   icon: Users,         roles: MANAGER_ROLES },
  { title: 'Projects',  href: '/projects',  icon: FolderKanban,  roles: MANAGER_ROLES },
  { title: 'Tasks',     href: '/tasks',     icon: CheckSquare,   roles: MANAGER_ROLES },
  { title: 'Calendar',  href: '/calendar',  icon: CalendarDays,  roles: MANAGER_ROLES },
  { title: 'Invoices',  href: '/invoices',  icon: Receipt,       roles: MANAGER_ROLES },
  { title: 'Payments',  href: '/payments',  icon: CreditCard,    roles: MANAGER_ROLES },
  { title: 'Reports',   href: '/reports',   icon: BarChart3,     roles: MANAGER_ROLES },

  // Member-only routes
  { title: 'My Tasks',  href: '/tasks',     icon: CheckSquare,   roles: ['member'] },
  { title: 'Income',    href: '/income',    icon: Wallet,        roles: ['member'] },

  // Visible to all roles
  { title: 'Team',      href: '/team',      icon: UsersRound },
]

/** Bottom-pinned navigation items. */
export const bottomNavItems: NavItem[] = [
  { title: 'Settings', href: '/settings', icon: Settings },
]
