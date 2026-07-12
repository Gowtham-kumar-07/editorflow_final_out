import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon:        LucideIcon
  title:       string
  description?: string
  action?:     {
    label:   string
    onClick?: () => void
    href?:   string
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border/60 shadow-sm">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">{description}</p>
      )}
      {action && (
        action.href ? (
          <Button variant="outline" size="sm" className="mt-5" asChild>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}
