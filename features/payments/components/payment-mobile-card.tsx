'use client'

import Link from 'next/link'
import { Receipt, Ban } from 'lucide-react'
import { formatDate, formatCurrency } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PaymentStatusBadge } from './payment-status-badge'
import { PaymentMethodBadge } from './payment-method-badge'
import { VoidPaymentDialog } from './void-payment-dialog'
import type { PaymentListItem } from '../types'
import type { OrgRole } from '@/types/supabase'
import { canVoidPayment } from '@/lib/permissions'


interface PaymentMobileCardProps {
  payment: PaymentListItem
  role:    OrgRole
}

export function PaymentMobileCard({ payment: p, role }: PaymentMobileCardProps) {
  const canVoid = canVoidPayment(role)

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{p.client_name || '—'}</p>
            <Link
              href={`/invoices/${p.invoice_id}`}
              className="text-sm text-primary hover:underline"
            >
              {p.invoice_number}
            </Link>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono font-semibold text-sm">
              {formatCurrency(p.amount, p.invoice_currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(p.payment_date)}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <PaymentStatusBadge status={p.status} />
          <PaymentMethodBadge method={p.payment_method} />
        </div>

        {/* Reference */}
        {p.transaction_reference && (
          <p className="text-xs text-muted-foreground truncate">
            Ref: {p.transaction_reference}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t">
          {p.status === 'completed' && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
              <a
                href={`/api/payments/${p.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Receipt className="h-3 w-3" />
                Receipt
              </a>
            </Button>
          )}
          {canVoid && p.status === 'completed' && (
            <VoidPaymentDialog
              paymentId={p.id}
              invoiceId={p.invoice_id}
              amount={p.amount}
              currency={p.invoice_currency}
              trigger={
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                  <Ban className="h-3 w-3" />
                  Void
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
