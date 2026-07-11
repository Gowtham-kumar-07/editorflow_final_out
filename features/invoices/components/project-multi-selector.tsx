'use client'

import { ChevronDown, FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/utils/format'
import type { ProjectOption } from '../types'

interface Props {
  projects:    ProjectOption[]
  selectedIds: string[]
  onToggle:    (project: ProjectOption) => void
  currency:    string
  disabled?:   boolean
  loading?:    boolean
}

export function ProjectMultiSelector({
  projects,
  selectedIds,
  onToggle,
  currency,
  disabled,
  loading,
}: Props) {
  const selectedProjects = projects.filter((p) => selectedIds.includes(p.id))

  const triggerLabel = loading
    ? 'Loading projects…'
    : !projects.length
    ? 'No projects for this client'
    : 'Add projects…'

  return (
    <div className="space-y-2">
      {/* ── Selected chips ──────────────────────────────────────────── */}
      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProjects.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="gap-1 pr-1 pl-2 py-1 text-xs font-medium"
            >
              <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span>{p.name}</span>
              {p.budget !== null && (
                <span className="text-muted-foreground">
                  · {formatCurrency(p.budget, currency)}
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggle(p)}
                disabled={disabled}
                className="ml-0.5 rounded hover:bg-destructive/15 hover:text-destructive p-0.5 transition-colors disabled:opacity-50"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* ── Dropdown selector ────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || loading || !projects.length}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            <span>{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Select projects for this invoice
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={selectedIds.includes(p.id)}
              onCheckedChange={() => onToggle(p)}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{p.name}</span>
              </div>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground ml-auto">
                {p.budget !== null
                  ? formatCurrency(p.budget, currency)
                  : <span className="italic">No price</span>}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
