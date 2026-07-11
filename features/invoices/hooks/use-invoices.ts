'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceKeys } from '../queries/invoice-queries'
import {
  getInvoices,
  getInvoice,
  getProjectsByClient,
  createInvoiceAction,
  updateInvoiceAction,
  transitionInvoiceStatusAction,
} from '../actions'
import type { InvoiceFilters } from '../types'
import type { InvoiceFormValues } from '../schema'
import type { InvoiceStatus } from '@/types/supabase'

// ── List ──────────────────────────────────────────────────────────────────────

export function useInvoices(orgId: string, filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey:  invoiceKeys.list(orgId, filters),
    queryFn:   () => getInvoices(filters),
    staleTime: 30 * 1000,
  })
}

// ── Detail ────────────────────────────────────────────────────────────────────

export function useInvoice(id: string) {
  return useQuery({
    queryKey:  invoiceKeys.detail(id),
    queryFn:   () => getInvoice(id),
    staleTime: 30 * 1000,
    enabled:   !!id,
  })
}

// ── Project options filtered by selected client ───────────────────────────────

export function useProjectsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey:  ['invoice-project-options', clientId],
    queryFn:   () => getProjectsByClient(clientId!),
    staleTime: 60 * 1000,
    enabled:   !!clientId,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateInvoice(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: InvoiceFormValues) => createInvoiceAction(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all(orgId) })
    },
  })
}

export function useUpdateInvoice(orgId: string, invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: InvoiceFormValues) => updateInvoiceAction(invoiceId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all(orgId) })
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) })
    },
  })
}

export function useTransitionInvoiceStatus(orgId: string, invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (newStatus: InvoiceStatus) =>
      transitionInvoiceStatusAction(invoiceId, newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all(orgId) })
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) })
    },
  })
}
