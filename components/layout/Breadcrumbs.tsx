'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems, bottomNavItems } from '@/lib/navigation'

const ALL_NAV_ITEMS = [...navItems, ...bottomNavItems]

const STATIC_LABELS: Record<string, string> = {
  new: 'New',
  edit: 'Edit',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function segmentLabel(segment: string): string {
  if (UUID_RE.test(segment)) return 'Details'
  if (STATIC_LABELS[segment]) return STATIC_LABELS[segment]
  const match = ALL_NAV_ITEMS.find((item) => item.href === `/${segment}`)
  if (match) return match.title
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => ({
    href: '/' + segments.slice(0, i + 1).join('/'),
    label: segmentLabel(seg),
    isLast: i === segments.length - 1,
  }))

  return (
    <nav aria-label="Breadcrumb" className={cn('flex min-w-0 items-center gap-1 overflow-hidden text-sm', className)}>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {crumb.isLast ? (
            <span className="truncate font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
