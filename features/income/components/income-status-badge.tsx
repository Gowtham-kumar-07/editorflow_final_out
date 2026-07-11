import { Badge } from '@/components/ui/badge'
import type { IncomeStatus } from '../types'

interface IncomeStatusBadgeProps {
  status: IncomeStatus
}

export function IncomeStatusBadge({ status }: IncomeStatusBadgeProps) {
  if (status === 'paid') {
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Paid</Badge>
  }
  return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending</Badge>
}
