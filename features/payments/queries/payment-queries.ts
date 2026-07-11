export const paymentKeys = {
  all:       (orgId: string) => ['payments', orgId] as const,
  list:      (orgId: string, filters?: object) =>
               [...paymentKeys.all(orgId), 'list', filters ?? {}] as const,
  summary:   (orgId: string) => [...paymentKeys.all(orgId), 'summary'] as const,
  byInvoice: (invoiceId: string) => ['payments', 'invoice', invoiceId] as const,
  clients:   (orgId: string) => ['payments', orgId, 'clients'] as const,
  payableInvoices: (orgId: string, clientId: string) =>
                     ['payments', orgId, 'payable-invoices', clientId] as const,
}
