'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ClientSearchProps {
  value: string
  onSearch: (query: string) => void
  placeholder?: string
}

export function ClientSearch({
  value,
  onSearch,
  placeholder = 'Search by company, contact or email…',
}: ClientSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const didMount = useRef(false)
  // Keep latest onSearch in a ref so it never drives the debounce effect.
  // Without this, any parent re-render that produces a new onSearch reference
  // (e.g. searchParams changing mid-navigation) restarts the timer and fires
  // router.push('/clients') while the user is navigating to /clients/new.
  const onSearchRef = useRef(onSearch)
  useEffect(() => { onSearchRef.current = onSearch })

  // Sync when the parent resets the value (e.g. clear-filters button)
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Debounce → propagate to parent after 300 ms of inactivity.
  // Intentionally omits onSearch from deps — use onSearchRef instead.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    const timeout = setTimeout(() => {
      onSearchRef.current(inputValue.trim())
    }, 300)
    return () => clearTimeout(timeout)
  }, [inputValue])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label="Search clients"
      />
      {inputValue && (
        <button
          onClick={() => {
            setInputValue('')
            onSearch('')
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
