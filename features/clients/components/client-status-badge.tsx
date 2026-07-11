import { Badge } from '@/components/ui/badge'
import type { ClientStatus } from '@/types/client'

const CONFIG: Record<ClientStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { label, variant } = CONFIG[status]
  return <Badge variant={variant}>{label}</Badge>
}
