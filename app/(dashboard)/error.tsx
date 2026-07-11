'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error boundary]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <p className="mt-4 text-sm font-medium">Something went wrong</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        An unexpected error occurred. Your data is safe — please try again.
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={reset}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button size="sm" variant="ghost" className="gap-2" asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
