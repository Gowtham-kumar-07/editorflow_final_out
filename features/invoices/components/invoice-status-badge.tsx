import { Badge } from '@/components/ui/badge'
import { getDisplayStatus } from '../types'
import type { InvoiceStatus } from '../types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusConfig {
  label:     string
  variant:   BadgeVariant
  className?: string
}

const STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  draft:     { label: 'Draft',     variant: 'secondary' },
  sent:      { label: 'Sent',      variant: 'default',
               className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300' },
  overdue:   { label: 'Overdue',   variant: 'destructive' },
  paid:      { label: 'Paid',      variant: 'secondary',
               className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300' },
  partial:   { label: 'Partial',   variant: 'outline',
               className: 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300' },
  cancelled: { label: 'Cancelled', variant: 'secondary',
               className: 'text-muted-foreground' },
}

interface Props {
  status:  InvoiceStatus
  dueDate?: string | null
}

export function InvoiceStatusBadge({ status, dueDate }: Props) {
  const displayStatus  = getDisplayStatus(status, dueDate ?? null)
  const { label, variant, className } = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.draft
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
