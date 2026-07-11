'use client'

import Link from 'next/link'
import { Receipt, Ban } from 'lucide-react'
import { formatDate } from '@/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from './payment-status-badge'
import { PaymentMethodBadge } from './payment-method-badge'
import { VoidPaymentDialog } from './void-payment-dialog'
import type { PaymentListItem } from '../types'
import type { OrgRole } from '@/types/supabase'
import { canVoidPayment } from '@/lib/permissions'

function fmtMoney(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

interface PaymentsTableProps {
  payments:  PaymentListItem[]
  role:      OrgRole
  loading?:  boolean
}

export function PaymentsTable({ payments, role, loading }: PaymentsTableProps) {
  const canVoid = canVoidPayment(role)

  if (loading) {
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {['Date', 'Client', 'Invoice', 'Method', 'Reference', 'Amount', 'Status', ''].map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                No payments found.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(p.payment_date)}
              </TableCell>

              <TableCell className="max-w-[140px] truncate text-sm">
                {p.client_name || '—'}
              </TableCell>

              <TableCell>
                <Link
                  href={`/invoices/${p.invoice_id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {p.invoice_number}
                </Link>
              </TableCell>

              <TableCell>
                <PaymentMethodBadge method={p.payment_method} />
              </TableCell>

              <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                {p.transaction_reference ?? '—'}
              </TableCell>

              <TableCell className="text-right font-mono text-sm font-medium whitespace-nowrap">
                {p.invoice_currency} {fmtMoney(p.amount)}
              </TableCell>

              <TableCell>
                <PaymentStatusBadge status={p.status} />
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  {p.status === 'completed' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a
                        href={`/api/payments/${p.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download receipt"
                      >
                        <Receipt className="h-3.5 w-3.5" />
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Void payment">
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
