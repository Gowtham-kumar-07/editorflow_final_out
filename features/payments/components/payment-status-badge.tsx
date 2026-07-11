import { Badge } from '@/components/ui/badge'

interface Props {
  status: string
}

export function PaymentStatusBadge({ status }: Props) {
  if (status === 'voided') {
    return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">Voided</Badge>
  }
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>
}
