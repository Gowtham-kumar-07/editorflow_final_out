'use client'

import { useState } from 'react'
import { canManagePayroll } from '@/lib/permissions'
import type { OrgRole } from '@/types/supabase'
import { useIncome } from '../hooks/use-income'
import { IncomeTable } from './income-table'
import { IncomeMobileCards } from './income-mobile-cards'
import { IncomeFilterBar } from './income-filters'
import type { IncomeFilters } from '../types'

interface OrgMemberOption {
  id:        string
  full_name: string | null
}

interface IncomeClientProps {
  role:    OrgRole
  members: OrgMemberOption[]
}

export function IncomeClient({ role, members }: IncomeClientProps) {
  const canManage = canManagePayroll(role)

  const [filters, setFilters] = useState<IncomeFilters>({
    page:     1,
    pageSize: 20,
  })

  const { data, isLoading } = useIncome(filters)
  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <IncomeFilterBar
        filters={filters}
        onChange={setFilters}
        members={members}
        canManage={canManage}
      />

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <IncomeTable items={items} canManage={canManage} />
          </div>

          {/* Mobile cards */}
          <div className="block md:hidden">
            <IncomeMobileCards items={items} canManage={canManage} />
          </div>
        </>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} ({data.total} records)
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border rounded disabled:opacity-40"
              disabled={data.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 border rounded disabled:opacity-40"
              disabled={data.page >= data.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
