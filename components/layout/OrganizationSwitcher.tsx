'use client'

import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useOrganizationContext } from '@/components/providers/organization-provider'
import { ROLE_LABELS } from '@/features/team/types'
import type { OrgRole } from '@/features/team/types'

// ─── Role badge styles ────────────────────────────────────────────────────────

const ROLE_CHIP: Record<OrgRole, string> = {
  owner:           'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin:           'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  project_manager: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  member:          'bg-muted text-muted-foreground',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizationSwitcher() {
  const { organization, allOrganizations, isSwitching, switchOrganization } =
    useOrganizationContext()

  const orgName = organization?.name ?? ''

  // Single-org: plain display only, no dropdown affordance
  if (allOrganizations.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 h-9 px-2 text-sm font-medium text-foreground/80">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="hidden max-w-[140px] truncate sm:block">{orgName}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-1.5 px-2 text-sm font-medium"
          disabled={isSwitching}
          aria-label="Switch organization"
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="hidden max-w-[140px] truncate sm:block">{orgName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground pb-1">
          Switch organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {allOrganizations.map((org) => {
          const isActive  = org.id === organization?.id
          const roleLabel = ROLE_LABELS[org.role as OrgRole] ?? org.role
          const chipClass = ROLE_CHIP[org.role as OrgRole] ?? ROLE_CHIP.member

          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => { if (!isActive) void switchOrganization(org.id) }}
              disabled={isActive || isSwitching}
              className={cn(
                'flex flex-col items-start gap-1 py-2.5 cursor-pointer',
                isActive && 'opacity-100 cursor-default',
              )}
            >
              <div className="flex w-full items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="flex-1 min-w-0 truncate text-sm font-medium leading-snug">
                  {org.name}
                </span>
                {isActive && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </div>
              <div className="flex items-center gap-2 pl-8">
                <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', chipClass)}>
                  {roleLabel}
                </span>
                {isActive && (
                  <span className="text-[11px] text-muted-foreground">Current</span>
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
