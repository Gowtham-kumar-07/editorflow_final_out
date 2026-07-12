'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'draft',     label: 'Draft'        },
  { value: 'sent',      label: 'Sent'         },
  { value: 'overdue',   label: 'Overdue'      },
  { value: 'paid',      label: 'Paid'         },
  { value: 'cancelled', label: 'Cancelled'    },
]

const SORT_OPTIONS = [
  { value: 'created_at',     label: 'Newest first'    },
  { value: 'issue_date',     label: 'Issue date'      },
  { value: 'due_date',       label: 'Due date'        },
  { value: 'total',          label: 'Amount'          },
  { value: 'invoice_number', label: 'Invoice number'  },
]

export function InvoiceSearchFilters() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')

  const status = searchParams.get('status') ?? 'all'
  const sortBy = searchParams.get('sortBy') ?? 'created_at'

  // Sync controlled input when URL is cleared externally
  useEffect(() => {
    setSearchValue(searchParams.get('search') ?? '')
  }, [searchParams])

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchValue(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => updateParam('search', val || null), 300)
  }

  function clearAll() {
    setSearchValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    router.push(pathname)
  }

  const hasActiveFilters = searchValue !== '' || status !== 'all' || sortBy !== 'created_at'

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search by invoice # or client…"
          value={searchValue}
          onChange={handleSearchChange}
        />
      </div>

      {/* Status filter */}
      <Select
        value={status}
        onValueChange={(v) => updateParam('status', v)}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={sortBy}
        onValueChange={(v) => updateParam('sortBy', v)}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
