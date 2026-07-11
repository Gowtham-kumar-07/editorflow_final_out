import { Badge } from '@/components/ui/badge'
import { PAYMENT_METHOD_LABELS } from '../types'
import type { PaymentMethod } from '../types'

interface Props {
  method: string
}

export function PaymentMethodBadge({ method }: Props) {
  const label = PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method
  return (
    <Badge variant="secondary" className="text-xs font-normal">
      {label}
    </Badge>
  )
}
