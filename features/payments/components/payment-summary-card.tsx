import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/utils/format'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  total:      number
  paidAmount: number
  balanceDue: number
  currency?:  string
  status:     string
}

export function PaymentSummaryCard({ total, paidAmount, balanceDue, currency = 'USD', status }: Props) {
  const isFullyPaid = status === 'paid'

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Invoice Total</span>
        <span className="tabular-nums font-medium">{formatCurrency(total, currency)}</span>
      </div>

      {paidAmount > 0 && (
        <div className="flex items-center justify-between text-green-600 dark:text-green-400">
          <span>Paid</span>
          <span className="tabular-nums">−{formatCurrency(paidAmount, currency)}</span>
        </div>
      )}

      <Separator />

      {isFullyPaid ? (
        <div className="flex items-center justify-between font-semibold text-green-600 dark:text-green-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Paid in Full
          </span>
          <span className="tabular-nums">{formatCurrency(0, currency)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between font-semibold text-base">
          <span>Balance Due</span>
          <span className="tabular-nums">{formatCurrency(balanceDue, currency)}</span>
        </div>
      )}
    </div>
  )
}
