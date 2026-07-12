'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { InvoiceStatusBadge } from './invoice-status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, formatDate } from '@/utils/format'
import type { InvoiceListItem } from '../types'

interface Props {
  invoices: InvoiceListItem[]
}

export function InvoicesTable({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="Adjust your filters or create a new invoice."
      />
    )
  }

  return (
    <>
      {/* ── Desktop table ───────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issue Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due Date</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-medium text-foreground hover:underline underline-offset-4"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                  <span className="block truncate">{inv.client_name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                  {inv.project_names.length
                    ? <span className="block truncate">{inv.project_names.join(', ')}</span>
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.due_date ? formatDate(inv.due_date) : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {formatCurrency(inv.total, inv.currency)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} dueDate={inv.due_date} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/invoices/${inv.id}`}
            className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium text-sm">{inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground">{inv.client_name}</p>
                {inv.project_names.length > 0 && (
                  <p className="text-xs text-muted-foreground">{inv.project_names.join(', ')}</p>
                )}
              </div>
              <InvoiceStatusBadge status={inv.status} dueDate={inv.due_date} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <span>Issued {formatDate(inv.issue_date)}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(inv.total, inv.currency)}
              </span>
            </div>
            {inv.due_date && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Due {formatDate(inv.due_date)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  )
}
