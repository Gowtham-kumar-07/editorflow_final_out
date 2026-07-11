import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'

const CONFIG: Record<
  ProjectStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  planning: { label: 'Planning', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  on_hold: {
    label: 'On Hold',
    variant: 'outline',
    className: 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
  },
  review: {
    label: 'In Review',
    variant: 'outline',
    className: 'border-blue-500 text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    className: 'border-green-500 text-green-600 dark:text-green-400',
  },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'outline' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, variant, className } = CONFIG[status] ?? CONFIG.active
  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  )
}
