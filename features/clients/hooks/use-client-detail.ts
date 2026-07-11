'use client'

import { useQuery } from '@tanstack/react-query'
import { clientKeys } from '../queries/client-queries'
import { getClientProjects, getClientInvoices, getClientActivityLogs } from '../actions'

export function useClientProjects(clientId: string) {
  return useQuery({
    queryKey: clientKeys.projects(clientId),
    queryFn:  () => getClientProjects(clientId),
    staleTime: 30 * 1000,
    enabled:  !!clientId,
  })
}

export function useClientInvoices(clientId: string) {
  return useQuery({
    queryKey: clientKeys.invoices(clientId),
    queryFn:  () => getClientInvoices(clientId),
    staleTime: 30 * 1000,
    enabled:  !!clientId,
  })
}

export function useClientActivity(clientId: string) {
  return useQuery({
    queryKey: clientKeys.activity(clientId),
    queryFn:  () => getClientActivityLogs(clientId),
    staleTime: 30 * 1000,
    enabled:  !!clientId,
  })
}
