'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { PAYMENT_METHODS } from '../schema'
import { PAYMENT_METHOD_LABELS } from '../types'
import type { PaymentMethod } from '../types'

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'voided',    label: 'Voided' },
]

const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All methods' },
  ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m as PaymentMethod] })),
]

export function PaymentSearchFilters() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const [searchValue, setSearchValue] = useState(params.get('search') ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync if URL clears externally (e.g. clear-all button)
  useEffect(() => {
    setSearchValue(params.get('search') ?? '')
  }, [params])

  const push = useCallback(
    (key: string, val: string) => {
      const sp = new URLSearchParams(params.toString())
      if (!val || val === 'all' || val === '') {
        sp.delete(key)
      } else {
        sp.set(key, val)
      }
      sp.delete('page')
      router.push(`${pathname}?${sp.toString()}`)
    },
    [router, pathname, params]
  )

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchValue(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => push('search', val), 500)
  }

  const hasFilters =
    params.has('search') ||
    params.has('status') ||
    params.has('method') ||
    params.has('dateFrom') ||
    params.has('dateTo')

  function clearAll() {
    setSearchValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    router.push(pathname)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search client, invoice, or reference…"
          className="pl-8"
          value={searchValue}
          onChange={handleSearchChange}
        />
      </div>

      {/* Status */}
      <Select
        value={params.get('status') ?? 'all'}
        onValueChange={(v) => push('status', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Method */}
      <Select
        value={params.get('method') ?? 'all'}
        onValueChange={(v) => push('method', v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          {METHOD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date from */}
      <Input
        type="date"
        className="w-[145px]"
        value={params.get('dateFrom') ?? ''}
        onChange={(e) => push('dateFrom', e.target.value)}
      />

      {/* Date to */}
      <Input
        type="date"
        className="w-[145px]"
        value={params.get('dateTo') ?? ''}
        onChange={(e) => push('dateTo', e.target.value)}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
