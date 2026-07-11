'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incomeKeys } from '../queries/income-queries'
import { getIncomeAction, getIncomeSummaryAction, markIncomePaidAction } from '../actions'
import type { IncomeFilters } from '../types'
import type { MarkPaidValues } from '../schema'

const STALE = 2 * 60 * 1000

export function useIncome(filters: IncomeFilters = {}) {
  return useQuery({
    queryKey:        incomeKeys.list(filters),
    queryFn:         () => getIncomeAction(filters),
    staleTime:       STALE,
    placeholderData: (prev) => prev,
  })
}

export function useIncomeSummary() {
  return useQuery({
    queryKey:  incomeKeys.summary(),
    queryFn:   () => getIncomeSummaryAction(),
    staleTime: STALE,
  })
}

export function useMarkIncomePaid() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ incomeId, values }: { incomeId: string; values: MarkPaidValues }) =>
      markIncomePaidAction(incomeId, values),

    onSuccess: (result) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: incomeKeys.all })
      }
    },
  })
}
