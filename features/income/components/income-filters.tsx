'use client'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { IncomeFilters } from '../types'

interface OrgMemberOption {
  id:        string
  full_name: string | null
}

interface IncomeFiltersProps {
  filters:    IncomeFilters
  onChange:   (next: IncomeFilters) => void
  members?:   OrgMemberOption[]
  canManage:  boolean
}

export function IncomeFilterBar({ filters, onChange, members = [], canManage }: IncomeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {canManage && members.length > 0 && (
        <Select
          value={filters.memberId ?? ''}
          onValueChange={(v) => onChange({ ...filters, memberId: v || undefined, page: 1 })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? m.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={filters.status ?? ''}
        onValueChange={(v) => onChange({ ...filters, status: (v || '') as typeof filters.status, page: 1 })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-full sm:w-[150px]"
        value={filters.from ?? ''}
        onChange={(e) => onChange({ ...filters, from: e.target.value || undefined, page: 1 })}
        placeholder="From"
        title="From date"
      />
      <Input
        type="date"
        className="w-full sm:w-[150px]"
        value={filters.to ?? ''}
        onChange={(e) => onChange({ ...filters, to: e.target.value || undefined, page: 1 })}
        placeholder="To"
        title="To date"
      />
    </div>
  )
}
