'use client'

import { User, Building2, DollarSign, FileText, CreditCard, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgRole } from '@/types/supabase'
import { canEditSettings } from '@/lib/permissions'

const ALL_SECTIONS = [
  { id: 'profile',           label: 'Profile',            icon: User,        adminOnly: false },
  { id: 'org-profile',       label: 'Organization',       icon: Building2,   adminOnly: true  },
  { id: 'financial',         label: 'Financial Defaults', icon: DollarSign,  adminOnly: true  },
  { id: 'invoice-branding',  label: 'Invoice Branding',   icon: FileText,    adminOnly: true  },
  { id: 'payment-details',   label: 'Payment Details',    icon: CreditCard,  adminOnly: true  },
  { id: 'media',             label: 'Logo & QR Code',     icon: Image,       adminOnly: true  },
]

interface SettingsNavProps {
  role:      OrgRole
  activeId?: string
}

export function SettingsNav({ role, activeId }: SettingsNavProps) {
  const isAdmin = canEditSettings(role)
  const sections = ALL_SECTIONS.filter((s) => !s.adminOnly || isAdmin)

  return (
    <nav className="flex flex-col gap-0.5">
      {sections.map((s) => {
        const Icon = s.icon
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              activeId === s.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {s.label}
          </a>
        )
      })}
    </nav>
  )
}
