import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { Separator } from '@/components/ui/separator'
import { InvoiceStatusBadge } from '@/features/invoices/components'
import { InvoiceActions }     from '@/features/invoices/components'
import { InvoiceSummary }     from '@/features/invoices/components'
import { getInvoice, getInvoiceUserRole } from '@/features/invoices/actions'
import { canViewInvoices, canViewPayments } from '@/lib/permissions'
import { formatCurrency, formatDate } from '@/utils/format'
import { createClient } from '@/supabase/server'
import { dbGetPaymentsByInvoice } from '@/features/payments/repository/payment.repository'
import { PaymentSummaryCard } from '@/features/payments/components'
import { PaymentHistory }     from '@/features/payments/components'

export const metadata: Metadata = { title: 'Invoice' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const [role, invoice] = await Promise.all([getInvoiceUserRole(), getInvoice(id)])

  if (!role || !canViewInvoices(role)) redirect('/dashboard')
  if (!invoice) notFound()

  const payments = canViewPayments(role)
    ? await dbGetPaymentsByInvoice(await createClient(), invoice.id)
    : []

  return (
    <PageContainer
      title={invoice.invoice_number}
      description={`Invoice for ${invoice.client.company_name}`}
      actions={
        <InvoiceActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          status={invoice.status}
          role={role}
          balanceDue={Number(invoice.balance_due)}
          currency={invoice.currency}
        />
      }
    >
      <div className="max-w-3xl space-y-8">

        {/* ── Header card ──────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Issued {formatDate(invoice.issue_date)}
                {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
              </p>
            </div>
            <InvoiceStatusBadge status={invoice.status} dueDate={invoice.due_date} />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            {/* Bill To */}
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill To
              </p>
              <p className="font-medium">{invoice.client.company_name}</p>
              {invoice.client.email && (
                <p className="text-muted-foreground">{invoice.client.email}</p>
              )}
              {invoice.client.address && (
                <p className="text-muted-foreground whitespace-pre-line">{invoice.client.address}</p>
              )}
            </div>

            <div className="space-y-3">
              {/* Projects (multi) */}
              {invoice.projects.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    {invoice.projects.length === 1 ? 'Project' : 'Projects'}
                  </p>
                  <div className="space-y-0.5">
                    {invoice.projects.map((p) => (
                      <div key={p.id}>
                        <Link
                          href={`/projects/${p.id}/workspace`}
                          className="text-foreground hover:underline underline-offset-4"
                        >
                          {p.name}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoice.payment_terms && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                    Payment Terms
                  </p>
                  <p>{invoice.payment_terms}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Line items ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Price</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.items.map((item) => (
                  <tr key={item.id} className={item.project_id ? 'bg-primary/[0.015]' : ''}>
                    <td className="px-4 py-3">
                      <span>{item.description}</span>
                      {item.project_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(project)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(item.quantity)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(Number(item.unit_price), invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(Number(item.amount), invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Financial summary ─────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-3">
            <InvoiceSummary
              subtotal={Number(invoice.subtotal)}
              discountType={invoice.discount_type as 'fixed' | 'percent'}
              discountValue={Number(invoice.discount_value)}
              discountAmount={Number(invoice.discount)}
              taxRate={Number(invoice.tax_rate)}
              taxAmount={Number(invoice.tax)}
              total={Number(invoice.total)}
              currency={invoice.currency}
            />
            {/* Payment balance row — only shown when a payment has been made */}
            {Number(invoice.paid_amount) > 0 && (
              <PaymentSummaryCard
                total={Number(invoice.total)}
                paidAmount={Number(invoice.paid_amount)}
                balanceDue={Number(invoice.balance_due)}
                currency={invoice.currency}
                status={invoice.status}
              />
            )}
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        {invoice.notes && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap text-muted-foreground">
              {invoice.notes}
            </div>
          </div>
        )}

        {/* ── Payment History ───────────────────────────────────────── */}
        {canViewPayments(role) && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Payment History</h3>
            <PaymentHistory
              payments={payments}
              currency={invoice.currency}
              role={role}
            />
          </div>
        )}

      </div>
    </PageContainer>
  )
}
