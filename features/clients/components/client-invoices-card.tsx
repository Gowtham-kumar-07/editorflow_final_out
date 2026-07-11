'use client'

import { FileText } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientInvoices } from '../hooks/use-client-detail'
import { formatCurrency, formatDate } from '@/utils/format'
import type { InvoiceStatus } from '../types'

// ─── Invoice status badge ─────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: BadgeVariant; className?: string }> = {
  draft:     { label: 'Draft',     variant: 'secondary' },
  sent:      { label: 'Sent',      variant: 'default' },
  paid:      { label: 'Paid',      variant: 'secondary', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300' },
  partial:   { label: 'Partial',   variant: 'outline' },
  overdue:   { label: 'Overdue',   variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, variant, className } = STATUS_CONFIG[status]
  return <Badge variant={variant} className={className}>{label}</Badge>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InvoicesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientInvoicesCard({ clientId }: { clientId: string }) {
  const { data: invoices, isLoading, isError } = useClientInvoices(clientId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <InvoicesSkeleton />}

        {isError && (
          <p className="text-sm text-destructive">Failed to load invoices.</p>
        )}

        {!isLoading && !isError && invoices?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          </div>
        )}

        {!isLoading && !isError && invoices && invoices.length > 0 && (
          <div className="divide-y">
            {invoices.slice(0, 5).map((invoice) => (
              <a
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invoice.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.due_date
                      ? `Due ${formatDate(invoice.due_date)}`
                      : formatDate(invoice.issue_date)}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <InvoiceStatusBadge status={invoice.status} />
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
              </a>
            ))}

            {invoices.length > 5 && (
              <p className="pt-2 text-xs text-muted-foreground">
                +{invoices.length - 5} more invoice{invoices.length - 5 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
