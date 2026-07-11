'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardDataAction } from '../actions'
import { dashboardKeys } from '../queries/dashboard-queries'
import type { DashboardData } from '../types'

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: dashboardKeys.data(),
    queryFn:  () => getDashboardDataAction(),
    staleTime: 60 * 1000,   // 1 minute
    retry:     1,
  })
}
