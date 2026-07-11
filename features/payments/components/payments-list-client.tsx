'use client'

import { useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentSummaryGrid } from './payment-summary-grid'
import { PaymentSearchFilters } from './payment-search-filters'
import { PaymentsTable } from './payments-table'
import { PaymentMobileCard } from './payment-mobile-card'
import { usePayments, usePaymentSummary } from '../hooks/use-payments'
import type { PaymentFilters, PaymentMethod } from '../types'
import type { OrgRole } from '@/types/supabase'

interface PaymentsListClientProps {
  orgId: string
  role:  OrgRole
}

export function PaymentsListClient({ orgId, role }: PaymentsListClientProps) {
  const params   = useSearchParams()
  const pathname = usePathname()

  const filters: PaymentFilters = {
    search:   params.get('search')   ?? undefined,
    status:   (params.get('status')  as PaymentFilters['status'])  ?? undefined,
    method:   (params.get('method')  as PaymentMethod | undefined) ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo:   params.get('dateTo')   ?? undefined,
    page:     Number(params.get('page') ?? '1'),
    pageSize: 20,
  }

  const { data: result, isLoading: listLoading }    = usePayments(orgId, filters)
  const { data: summary, isLoading: summaryLoading } = usePaymentSummary(orgId)

  function buildPageUrl(target: number) {
    const sp = new URLSearchParams(params.toString())
    sp.set('page', String(target))
    return `${pathname}?${sp.toString()}`
  }

  const currentPage  = result?.page       ?? 1
  const totalPages   = result?.totalPages ?? 1
  const total        = result?.total      ?? 0
  const payments     = result?.payments   ?? []

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <PaymentSummaryGrid metrics={summary} loading={summaryLoading} />

      {/* Filters */}
      <PaymentSearchFilters />

      {/* Result count */}
      {!listLoading && (
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'No payments found' : `${total} payment${total === 1 ? '' : 's'}`}
        </p>
      )}
      {listLoading && <Skeleton className="h-4 w-24" />}

      {/* Desktop table */}
      <div className="hidden md:block">
        <PaymentsTable payments={payments} role={role} loading={listLoading} />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {listLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))
        ) : payments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No payments found.</p>
        ) : (
          payments.map((p) => (
            <PaymentMobileCard key={p.id} payment={p} role={role} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={currentPage <= 1}
          >
            <Link href={buildPageUrl(currentPage - 1)}>Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={currentPage >= totalPages}
          >
            <Link href={buildPageUrl(currentPage + 1)}>Next</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
