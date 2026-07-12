'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useGlobalSearch } from '../context/global-search-context'
import { useOrganizationContext } from '@/components/providers/organization-provider'
import { globalSearchAction } from '../actions'
import { globalSearchKeys } from '../queries/global-search-queries'
import { addRecentItem, getRecentItems } from '../utils/recent-items-storage'
import { SearchResultItem } from './search-result-item'
import { QuickActions } from './quick-actions'
import { RecentItems } from './recent-items'
import type { GlobalSearchResult, GlobalSearchResultType, RecentItem } from '../types'

const ENTITY_ORDER: GlobalSearchResultType[] = [
  'task', 'project', 'client', 'invoice', 'payment', 'team_member',
]

const ENTITY_LABELS: Record<GlobalSearchResultType, string> = {
  task:        'Tasks',
  project:     'Projects',
  client:      'Clients',
  invoice:     'Invoices',
  payment:     'Payments',
  team_member: 'Team',
}

export function GlobalSearchDialog() {
  const { isOpen, open, close, userId } = useGlobalSearch()
  const { organization }                 = useOrganizationContext()
  const router                           = useRouter()

  const [inputValue,     setInputValue]     = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [recentItems,    setRecentItems]    = useState<RecentItem[]>([])

  const orgId = organization?.id ?? ''

  // ── Global keyboard shortcut ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) { close() } else { open() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, open, close])

  // ── Debounce search input ────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = inputValue.trim()
    if (trimmed.length < 2) {
      setDebouncedQuery('')
      return
    }
    const id = setTimeout(() => setDebouncedQuery(trimmed), 300)
    return () => clearTimeout(id)
  }, [inputValue])

  // ── Load recent items (user+org scoped) ──────────────────────────────────────
  useEffect(() => {
    if (userId && orgId) {
      setRecentItems(getRecentItems(userId, orgId))
    }
  }, [userId, orgId, isOpen])

  // ── Reset state when dialog closes ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setInputValue('')
      setDebouncedQuery('')
    }
  }, [isOpen])

  // ── Search query ─────────────────────────────────────────────────────────────
  const { data: results = [], isFetching } = useQuery({
    queryKey:  globalSearchKeys.query(debouncedQuery),
    queryFn:   () => globalSearchAction(debouncedQuery),
    enabled:   debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  // ── Group results by entity type ─────────────────────────────────────────────
  const grouped = ENTITY_ORDER.reduce<Record<GlobalSearchResultType, GlobalSearchResult[]>>(
    (acc, type) => {
      acc[type] = results.filter((r) => r.type === type)
      return acc
    },
    {} as Record<GlobalSearchResultType, GlobalSearchResult[]>
  )

  const activeGroups = ENTITY_ORDER.filter((t) => grouped[t].length > 0)

  // ── Navigation helpers ───────────────────────────────────────────────────────
  function handleSelectResult(result: GlobalSearchResult) {
    if (userId && orgId) {
      addRecentItem(userId, orgId, {
        id:        result.id,
        type:      result.type,
        title:     result.title,
        subtitle:  result.subtitle,
        actionUrl: result.actionUrl,
      })
    }
    router.push(result.actionUrl)
    close()
  }

  function handleSelectRecent(item: RecentItem) {
    router.push(item.actionUrl)
    close()
  }

  // ── Display state ────────────────────────────────────────────────────────────
  const isSearching = debouncedQuery.length >= 2
  const showHint    = inputValue.trim().length === 1
  const showEmpty   = isSearching && !isFetching && results.length === 0
  const showResults = isSearching && !isFetching && results.length > 0
  const showDefault = !isSearching && !showHint

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search clients, projects, tasks, invoices…"
            value={inputValue}
            onValueChange={setInputValue}
          />

          <CommandList>
            {/* ── 1-char hint ── */}
            {showHint && (
              <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
            )}

            {/* ── Loading ── */}
            {isSearching && isFetching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {/* ── No results ── */}
            {showEmpty && (
              <CommandEmpty>No results for &ldquo;{debouncedQuery}&rdquo;</CommandEmpty>
            )}

            {/* ── Search results grouped by entity ── */}
            {showResults && activeGroups.map((type, idx) => (
              <div key={type}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={ENTITY_LABELS[type]}>
                  {grouped[type].map((result) => (
                    <SearchResultItem
                      key={result.id}
                      result={result}
                      onSelect={() => handleSelectResult(result)}
                    />
                  ))}
                </CommandGroup>
              </div>
            ))}

            {/* ── Default: quick actions + recent items ── */}
            {showDefault && (
              <>
                <QuickActions role={organization?.role} onSelect={close} />
                {recentItems.length > 0 && (
                  <>
                    <CommandSeparator />
                    <RecentItems items={recentItems} onSelect={handleSelectRecent} />
                  </>
                )}
                {!organization?.role && (
                  <CommandEmpty>Start typing to search</CommandEmpty>
                )}
              </>
            )}
          </CommandList>

          {/* ── Keyboard hint footer ── */}
          <div className="border-t px-4 py-2">
            <p className="text-[11px] text-muted-foreground">
              <kbd className="font-mono font-medium">↑↓</kbd>
              <span className="mx-1.5">navigate</span>
              <span className="mx-1 opacity-40">·</span>
              <kbd className="font-mono font-medium">↵</kbd>
              <span className="mx-1.5">open</span>
              <span className="mx-1 opacity-40">·</span>
              <kbd className="font-mono font-medium">Esc</kbd>
              <span className="mx-1.5">close</span>
            </p>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
