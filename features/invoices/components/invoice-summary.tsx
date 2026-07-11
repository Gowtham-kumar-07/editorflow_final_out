import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/utils/format'
import type { DiscountType } from '../types'

interface Props {
  subtotal:      number
  discountType:  DiscountType
  discountValue: number
  discountAmount: number
  taxRate:       number
  taxAmount:     number
  total:         number
  currency?:     string
}

export function InvoiceSummary({
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  taxRate,
  taxAmount,
  total,
  currency = 'USD',
}: Props) {
  const taxable = subtotal - discountAmount

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums">{formatCurrency(subtotal, currency)}</span>
      </div>

      {discountAmount > 0 && (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>
            Discount
            {discountType === 'percent'
              ? ` (${discountValue}%)`
              : ''}
          </span>
          <span className="tabular-nums text-green-600 dark:text-green-400">
            −{formatCurrency(discountAmount, currency)}
          </span>
        </div>
      )}

      {discountAmount > 0 && (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Taxable amount</span>
          <span className="tabular-nums">{formatCurrency(taxable, currency)}</span>
        </div>
      )}

      {taxAmount > 0 && (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Tax ({taxRate}%)</span>
          <span className="tabular-nums">{formatCurrency(taxAmount, currency)}</span>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between font-semibold text-base">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  )
}
