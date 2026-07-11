import { formatCurrency, formatDate } from '@/utils/format'
import { PaymentStatusBadge }   from './payment-status-badge'
import { PaymentMethodBadge }   from './payment-method-badge'
import { VoidPaymentDialog }    from './void-payment-dialog'
import type { PaymentRecord }   from '../types'
import type { OrgRole }         from '@/types/supabase'
import { canVoidPayment }       from '@/lib/permissions'

interface Props {
  payments: PaymentRecord[]
  currency?: string
  role:      OrgRole
}

export function PaymentHistory({ payments, currency = 'USD', role }: Props) {
  const canVoid = canVoidPayment(role)

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No payments recorded yet.
      </p>
    )
  }

  return (
    <div className="divide-y rounded-lg border overflow-hidden">
      {payments.map((payment) => {
        const isVoided = payment.status === 'voided'
        return (
          <div
            key={payment.id}
            className={`flex items-start justify-between gap-4 px-4 py-3 ${isVoided ? 'opacity-50 bg-muted/20' : ''}`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium tabular-nums ${isVoided ? 'line-through text-muted-foreground' : ''}`}>
                  {formatCurrency(payment.amount, currency)}
                </span>
                <PaymentMethodBadge method={payment.payment_method} />
                <PaymentStatusBadge status={payment.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(payment.payment_date)}
                {payment.transaction_reference && (
                  <> · Ref: {payment.transaction_reference}</>
                )}
              </p>
              {/* FX row — only shown when the payment was in a different currency */}
              {payment.transaction_currency &&
               payment.base_currency &&
               payment.transaction_currency !== payment.base_currency && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(payment.base_amount, payment.base_currency)} at{' '}
                  {payment.fx_rate.toFixed(4)} {payment.transaction_currency}/{payment.base_currency}
                  {payment.fx_rate_source === 'fallback_1' && (
                    <span className="ml-1 text-amber-600">(rate estimated)</span>
                  )}
                </p>
              )}
              {payment.notes && (
                <p className="text-xs text-muted-foreground">{payment.notes}</p>
              )}
              {isVoided && payment.void_reason && (
                <p className="text-xs text-muted-foreground italic">
                  Voided: {payment.void_reason}
                </p>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center gap-1">
              {!isVoided && canVoid && (
                <VoidPaymentDialog
                  paymentId={payment.id}
                  amount={payment.amount}
                  currency={currency}
                />
              )}
              <a
                href={`/api/payments/${payment.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Receipt
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}
