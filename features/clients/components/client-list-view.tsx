'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useClients } from '../hooks/use-clients'
import { ClientSearch } from './client-search'
import { ClientFilters } from './client-filters'
import { ClientTable } from './client-table'
import { ClientCard } from './client-card'
import { ClientLoadingSkeleton } from './client-loading-skeleton'
import { ClientEmptyState } from './client-empty-state'
import { ClientErrorState } from './client-error-state'
import type {
  ClientFilters as ClientQueryFilters,
  ClientSortField,
  ClientSortOrder,
  ClientStatusFilter,
} from '../types'

// ─── URL param helpers ────────────────────────────────────────────────────────

function getParam(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientListView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse filter state from URL
  const search       = getParam(searchParams, 'q', '')
  const statusFilter = getParam(searchParams, 'status', 'active') as ClientStatusFilter
  const sortBy       = getParam(searchParams, 'sortBy', 'created_at') as ClientSortField
  const sortOrder    = getParam(searchParams, 'sortOrder', 'desc') as ClientSortOrder
  const page         = Math.max(1, Number(getParam(searchParams, 'page', '1')) || 1)

  const filters: ClientQueryFilters = { search, statusFilter, sortBy, sortOrder, page }

  const { data, isLoading, isError, refetch } = useClients(filters)

  // Update URL params without resetting other params.
  // Changing any filter resets page to 1.
  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      if (resetPage) params.delete('page')
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Stable reference — prevents ClientSearch's debounce useEffect from
  // re-firing on every ClientListView render during route transitions.
  const handleSearch = useCallback(
    (q: string) => updateParams({ q: q || null }),
    [updateParams]
  )

  function clearFilters() {
    router.push(pathname, { scroll: false })
  }

  const hasFilters =
    Boolean(search) ||
    statusFilter !== 'active' ||
    sortBy !== 'created_at' ||
    sortOrder !== 'desc'

  if (isLoading) return <ClientLoadingSkeleton />
  if (isError) {
    return (
      <ClientErrorState
        onRetry={() => void refetch()}
      />
    )
  }

  const clients = data?.clients ?? []

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ClientSearch
          value={search}
          onSearch={handleSearch}
        />
        <ClientFilters
          statusFilter={statusFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onStatusChange={(s) =>
            updateParams({ status: s === 'active' ? null : s })
          }
          onSortChange={(by, order) =>
            updateParams({
              sortBy: by === 'created_at' ? null : by,
              sortOrder: order === 'desc' ? null : order,
            })
          }
        />
      </div>

      {clients.length === 0 ? (
        <ClientEmptyState
          hasFilters={hasFilters}
          statusFilter={statusFilter}
          onClearFilters={hasFilters ? clearFilters : undefined}
        />
      ) : (
        <>
          {/* Desktop: full table */}
          <div className="hidden sm:block">
            <ClientTable
              clients={clients}
              total={data?.total ?? 0}
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={(p) => updateParams({ page: String(p) }, false)}
            />
          </div>

          {/* Mobile: card list + inline pagination */}
          <div className="sm:hidden space-y-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>{data.total} clients</span>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: String(page - 1) }, false)}
                  >
                    Previous
                  </button>
                  <span className="text-xs tabular-nums">{page} / {data.totalPages}</span>
                  <button
                    className="text-xs underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline"
                    disabled={page >= data.totalPages}
                    onClick={() => updateParams({ page: String(page + 1) }, false)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
