'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
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
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()

  const search  = searchParams.get('search')  ?? ''
  const status  = searchParams.get('status')  ?? 'all'
  const sortBy  = searchParams.get('sortBy')  ?? 'created_at'

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page')  // reset pagination on filter change
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const hasActiveFilters = search !== '' || status !== 'all' || sortBy !== 'created_at'

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search by invoice # or client…"
          defaultValue={search}
          onChange={(e) => {
            const val = e.target.value
            const params = new URLSearchParams(searchParams.toString())
            if (val) { params.set('search', val) } else { params.delete('search') }
            params.delete('page')
            router.push(`${pathname}?${params.toString()}`)
          }}
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

      {/* Clear */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(pathname)}
          aria-label="Clear filters"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
