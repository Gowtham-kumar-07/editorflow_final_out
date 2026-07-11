'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { ClientStatusFilter, ClientSortField, ClientSortOrder } from '../types'

// ─── Status tabs ──────────────────────────────────────────────────────────────

const STATUS_TABS: { value: ClientStatusFilter; label: string }[] = [
  { value: 'active',   label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all',      label: 'All' },
]

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortValue = `${ClientSortField}:${ClientSortOrder}`

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'created_at:desc',    label: 'Newest first' },
  { value: 'created_at:asc',     label: 'Oldest first' },
  { value: 'company_name:asc',   label: 'Name A → Z' },
  { value: 'company_name:desc',  label: 'Name Z → A' },
  { value: 'updated_at:desc',    label: 'Recently updated' },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface ClientFiltersProps {
  statusFilter: ClientStatusFilter
  sortBy: ClientSortField
  sortOrder: ClientSortOrder
  onStatusChange: (status: ClientStatusFilter) => void
  onSortChange: (sortBy: ClientSortField, sortOrder: ClientSortOrder) => void
}

export function ClientFilters({
  statusFilter,
  sortBy,
  sortOrder,
  onStatusChange,
  onSortChange,
}: ClientFiltersProps) {
  const currentSort: SortValue = `${sortBy}:${sortOrder}`

  function handleSortChange(value: string) {
    const [field, order] = value.split(':') as [ClientSortField, ClientSortOrder]
    onSortChange(field, order)
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Status tabs */}
      <div className="flex rounded-md border p-0.5">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 rounded-sm px-3 text-xs"
            onClick={() => onStatusChange(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Sort */}
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="h-9 w-[175px]" aria-label="Sort clients">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
