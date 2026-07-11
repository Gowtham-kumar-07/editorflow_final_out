'use client'

interface CurrencySectionProps {
  currency:  string
  children:  React.ReactNode
  className?: string
}

export function CurrencySection({ currency, children, className }: CurrencySectionProps) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {currency}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </div>
  )
}
