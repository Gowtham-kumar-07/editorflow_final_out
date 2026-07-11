import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProjectPriority } from '@/types/project'

const CONFIG: Record<
  ProjectPriority,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  low: {
    label: 'Low',
    variant: 'outline',
    className: 'border-slate-400 text-slate-500 dark:text-slate-400',
  },
  medium: {
    label: 'Medium',
    variant: 'outline',
    className: 'border-blue-400 text-blue-600 dark:text-blue-400',
  },
  high: {
    label: 'High',
    variant: 'outline',
    className: 'border-orange-400 text-orange-600 dark:text-orange-400',
  },
  urgent: { label: 'Urgent', variant: 'destructive' },
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const { label, variant, className } = CONFIG[priority] ?? CONFIG.medium
  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  )
}
