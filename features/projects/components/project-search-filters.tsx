'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClientOption } from '@/types/client'

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A → Z' },
  { value: 'name-desc', label: 'Name Z → A' },
  { value: 'due-date', label: 'Due date' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'budget-desc', label: 'Budget (high → low)' },
] as const

export type ProjectSortOption = (typeof SORT_OPTIONS)[number]['value']

type ProjectSearchFiltersProps = {
  defaultSearch: string
  defaultStatus: string
  defaultPriority: string
  defaultClientId: string
  defaultSort: ProjectSortOption
  clientOptions: ClientOption[]
}

export function ProjectSearchFilters({
  defaultSearch,
  defaultStatus,
  defaultPriority,
  defaultClientId,
  defaultSort,
  clientOptions,
}: ProjectSearchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [inputValue, setInputValue] = useState(defaultSearch)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (inputValue.trim()) {
        params.set('q', inputValue.trim())
      } else {
        params.delete('q')
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timeout)
  }, [inputValue, pathname, router, searchParams])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === '__all__') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search projects…"
          className="pl-9 pr-9"
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 2: Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Status */}
        <Select
          value={defaultStatus || '__all__'}
          onValueChange={(v) => updateParam('status', v)}
        >
          <SelectTrigger className="h-9 w-full sm:w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="review">In Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select
          value={defaultPriority || '__all__'}
          onValueChange={(v) => updateParam('priority', v)}
        >
          <SelectTrigger className="h-9 w-full sm:w-[140px]">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        {/* Client */}
        {clientOptions.length > 0 && (
          <Select
            value={defaultClientId || '__all__'}
            onValueChange={(v) => updateParam('client_id', v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        <Select value={defaultSort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger className="h-9 w-full sm:w-[180px] sm:ml-auto">
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
    </div>
  )
}
