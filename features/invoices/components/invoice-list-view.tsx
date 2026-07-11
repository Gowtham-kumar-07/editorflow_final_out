'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ErrorState }           from '@/components/shared/error-state'
import { InvoicesTable }        from './invoices-table'
import { InvoiceSearchFilters } from './invoice-search-filters'
import { useInvoices } from '../hooks/use-invoices'
import type { InvoiceFilters, InvoiceSortField } from '../types'
import type { InvoiceStatus } from '@/types/supabase'

interface Props {
  orgId: string
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function InvoiceListView({ orgId }: Props) {
  const searchParams = useSearchParams()
  const pathname     = usePathname()
  const router       = useRouter()
  const page         = parseInt(searchParams.get('page') ?? '1', 10)

  const filters: InvoiceFilters = {
    search:    searchParams.get('search')  ?? undefined,
    status:    (searchParams.get('status') ?? 'all') as InvoiceStatus | 'all',
    sortBy:    (searchParams.get('sortBy') ?? 'created_at') as InvoiceSortField,
    sortOrder: 'desc',
    page,
    pageSize:  20,
  }

  const { data, isLoading, isError, refetch } = useInvoices(orgId, filters)

  function buildPageUrl(target: number) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('page', String(target))
    return `${pathname}?${sp.toString()}`
  }

  return (
    <div className="space-y-4">
      <InvoiceSearchFilters />

      {isLoading && <TableSkeleton />}

      {isError && (
        <div className="rounded-lg border">
          <ErrorState
            title="Failed to load invoices"
            message="Unable to load your invoices. Please try again."
            onRetry={() => refetch()}
          />
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          <InvoicesTable invoices={data.invoices} />

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {((data.page - 1) * data.pageSize) + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => router.push(buildPageUrl(data.page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => router.push(buildPageUrl(data.page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
