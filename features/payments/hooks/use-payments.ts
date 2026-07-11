'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentKeys } from '../queries/payment-queries'
import {
  getPaymentsAction,
  getPaymentSummaryAction,
  getOrgClientsAction,
  getPayableInvoicesForClientAction,
  recordPaymentAction,
  voidPaymentAction,
} from '../actions'
import type { PaymentFilters } from '../types'
import type { RecordPaymentInput, VoidPaymentInput } from '../schema'

// ── Org-wide ledger ───────────────────────────────────────────────────────────

export function usePayments(orgId: string, filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: paymentKeys.list(orgId, filters),
    queryFn:  () => getPaymentsAction(filters),
    staleTime: 30 * 1000,
    enabled:  !!orgId,
  })
}

// ── Summary metrics ───────────────────────────────────────────────────────────

export function usePaymentSummary(orgId: string) {
  return useQuery({
    queryKey: paymentKeys.summary(orgId),
    queryFn:  () => getPaymentSummaryAction(),
    staleTime: 60 * 1000,
    enabled:  !!orgId,
  })
}

// ── Clients for record-payment dialog ────────────────────────────────────────

export function useOrgClients(orgId: string) {
  return useQuery({
    queryKey: paymentKeys.clients(orgId),
    queryFn:  () => getOrgClientsAction(),
    staleTime: 5 * 60 * 1000,
    enabled:  !!orgId,
  })
}

// ── Payable invoices per client ───────────────────────────────────────────────

export function usePayableInvoices(orgId: string, clientId: string | null) {
  return useQuery({
    queryKey: paymentKeys.payableInvoices(orgId, clientId ?? ''),
    queryFn:  () => getPayableInvoicesForClientAction(clientId!),
    staleTime: 30 * 1000,
    enabled:  !!orgId && !!clientId,
  })
}

// ── Record payment ────────────────────────────────────────────────────────────

export function useRecordPayment(orgId: string, invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPaymentAction(invoiceId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.all(orgId) })
      qc.invalidateQueries({ queryKey: paymentKeys.byInvoice(invoiceId) })
      qc.invalidateQueries({ queryKey: ['invoices', orgId] })
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
    },
  })
}

// ── Void payment ──────────────────────────────────────────────────────────────

export function useVoidPayment(orgId: string, invoiceId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentId, input }: { paymentId: string; input: VoidPaymentInput }) =>
      voidPaymentAction(paymentId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.all(orgId) })
      if (invoiceId) {
        qc.invalidateQueries({ queryKey: paymentKeys.byInvoice(invoiceId) })
        qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      }
      qc.invalidateQueries({ queryKey: ['invoices', orgId] })
    },
  })
}
