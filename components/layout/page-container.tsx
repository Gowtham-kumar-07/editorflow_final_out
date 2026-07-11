import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type PageContainerProps = {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  actions?: ReactNode
}

export function PageContainer({
  children,
  className,
  title,
  description,
  actions,
}: PageContainerProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-6 p-6 lg:p-8', className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
