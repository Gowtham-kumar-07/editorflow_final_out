'use client'

import { useQuery } from '@tanstack/react-query'
import { reportKeys } from '../queries/report-queries'
import {
  getOverviewReportAction,
  getRevenueReportAction,
  getReceivablesReportAction,
  getClientRevenueReportAction,
  getProjectDeliveryReportAction,
  getTaskPerformanceReportAction,
  getTeamPerformanceReportAction,
  getBottlenecksReportAction,
  getPayrollReportAction,
} from '../actions'
import type {
  OverviewReport,
  RevenueReport,
  ReceivablesReport,
  ClientRevenueReport,
  ProjectDeliveryReport,
  TaskPerformanceReport,
  TeamPerformanceReport,
  BottlenecksReport,
  PayrollReport,
} from '../types'

const STALE = 2 * 60 * 1000 // 2 minutes

export function useOverviewReport(from: string, to: string) {
  return useQuery<OverviewReport>({
    queryKey:        reportKeys.overview(from, to),
    queryFn:         () => getOverviewReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useRevenueReport(from: string, to: string) {
  return useQuery<RevenueReport>({
    queryKey:        reportKeys.revenue(from, to),
    queryFn:         () => getRevenueReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useReceivablesReport() {
  return useQuery<ReceivablesReport>({
    queryKey: reportKeys.receivables('', ''),
    queryFn:  () => getReceivablesReportAction(),
    staleTime: STALE,
    retry:     1,
  })
}

export function useClientRevenueReport(from: string, to: string) {
  return useQuery<ClientRevenueReport>({
    queryKey:        reportKeys.clients(from, to),
    queryFn:         () => getClientRevenueReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useProjectDeliveryReport(from: string, to: string) {
  return useQuery<ProjectDeliveryReport>({
    queryKey:        reportKeys.projects(from, to),
    queryFn:         () => getProjectDeliveryReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useTaskPerformanceReport(from: string, to: string) {
  return useQuery<TaskPerformanceReport>({
    queryKey:        reportKeys.tasks(from, to),
    queryFn:         () => getTaskPerformanceReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useTeamPerformanceReport(from: string, to: string) {
  return useQuery<TeamPerformanceReport>({
    queryKey:        reportKeys.team(from, to),
    queryFn:         () => getTeamPerformanceReportAction({ from, to }),
    staleTime:       STALE,
    retry:           1,
    placeholderData: (prev) => prev,
  })
}

export function useBottlenecksReport() {
  return useQuery<BottlenecksReport>({
    queryKey: reportKeys.bottlenecks('', ''),
    queryFn:  () => getBottlenecksReportAction(),
    staleTime: STALE,
    retry:     1,
  })
}

export function usePayrollReport() {
  return useQuery<PayrollReport>({
    queryKey: ['reports', 'payroll'],
    queryFn:  () => getPayrollReportAction(),
    staleTime: STALE,
    retry:     1,
  })
}
