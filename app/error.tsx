'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Only log the opaque digest — never expose the message or stack in production
    const ref = error.digest ?? 'no-digest'
    if (process.env.NODE_ENV !== 'production') {
      console.error('[app error]', error)
    } else {
      console.error('[app error]', ref)
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="mt-5 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Your data is safe — please try again or return to the dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <Button size="sm" variant="outline" className="gap-2" onClick={reset}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button size="sm" className="gap-2" asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
