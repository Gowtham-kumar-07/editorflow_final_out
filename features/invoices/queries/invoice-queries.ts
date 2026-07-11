export const invoiceKeys = {
  all:    (orgId: string) => ['invoices', orgId] as const,
  list:   (orgId: string, filters?: object) =>
            [...invoiceKeys.all(orgId), 'list', filters ?? {}] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
}
