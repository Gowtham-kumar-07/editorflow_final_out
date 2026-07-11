'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Download, Edit, Send, AlertTriangle, XCircle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { transitionInvoiceStatusAction } from '../actions'
import type { InvoiceStatus } from '../types'
import type { OrgRole } from '@/types/supabase'
import {
  canEditInvoice,
  canTransitionInvoiceStatus,
  canCancelInvoice,
  canRecordPayment,
  getAllowedInvoiceStatusTransitions,
} from '@/lib/permissions'
import { RecordPaymentDialog } from '@/features/payments/components'

interface Props {
  invoiceId:     string
  invoiceNumber: string
  status:        InvoiceStatus
  role:          OrgRole
  balanceDue?:   number
  currency?:     string
}

export function InvoiceActions({ invoiceId, invoiceNumber, status, role, balanceDue = 0, currency = 'USD' }: Props) {
  const router               = useRouter()
  const [loading, setLoading] = useState<InvoiceStatus | null>(null)

  const allowedTransitions = getAllowedInvoiceStatusTransitions(status)
  const isDraft       = status === 'draft'
  const isCancelled   = status === 'cancelled'
  const isPaid        = status === 'paid'
  const isReadOnly    = isCancelled || isPaid
  const canEdit       = canEditInvoice(role) && isDraft
  const canTransition = canTransitionInvoiceStatus(role)
  const canCancel     = canCancelInvoice(role) && !isReadOnly
  const canPayment    = canRecordPayment(role) && !isDraft && !isCancelled && !isPaid && balanceDue > 0

  async function transition(newStatus: InvoiceStatus) {
    setLoading(newStatus)
    const result = await transitionInvoiceStatusAction(invoiceId, newStatus)
    setLoading(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Invoice marked as ${newStatus}`)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Record Payment */}
      {canPayment && (
        <RecordPaymentDialog
          invoiceId={invoiceId}
          balanceDue={balanceDue}
          currency={currency}
        />
      )}

      {/* PDF Download */}
      <Button variant="outline" size="sm" asChild>
        <a
          href={`/api/invoices/${invoiceId}/pdf`}
          target="_blank"
          rel="noreferrer"
          download={`${invoiceNumber}.pdf`}
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </a>
      </Button>

      {/* Edit (draft only) */}
      {canEdit && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/invoices/${invoiceId}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      )}

      {/* Mark as Sent */}
      {canTransition && allowedTransitions.includes('sent') && (
        <Button
          size="sm"
          onClick={() => transition('sent')}
          disabled={loading !== null}
        >
          {loading === 'sent'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Send className="mr-2 h-4 w-4" />}
          Mark as Sent
        </Button>
      )}

      {/* Mark as Overdue */}
      {canTransition && allowedTransitions.includes('overdue') && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => transition('overdue')}
          disabled={loading !== null}
        >
          {loading === 'overdue'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <AlertTriangle className="mr-2 h-4 w-4" />}
          Mark as Overdue
        </Button>
      )}

      {/* Cancel Invoice */}
      {canCancel && allowedTransitions.includes('cancelled') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={loading !== null}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Invoice
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invoice {invoiceNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the invoice as cancelled. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => transition('cancelled')}
              >
                Cancel Invoice
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
