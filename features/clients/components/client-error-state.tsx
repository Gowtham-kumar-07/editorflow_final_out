import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClientErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ClientErrorState({
  message = 'Something went wrong while loading your clients.',
  onRetry,
}: ClientErrorStateProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="mt-4 text-sm font-medium">Failed to load clients</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
