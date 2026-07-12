'use client'

import React from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  label?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    logger.error('component error boundary triggered', { label: this.props.label ?? 'unknown' })
    if (process.env.NODE_ENV !== 'production') {
      console.error('[error boundary]', error)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <p className="mt-3 text-sm font-medium">Failed to load this section</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Refresh the page to try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-2"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
