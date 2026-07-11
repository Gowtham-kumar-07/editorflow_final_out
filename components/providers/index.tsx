'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from './theme-provider'
import { QueryProvider } from './query-provider'
import { Toaster } from '@/components/ui/sonner'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster richColors closeButton />
      </QueryProvider>
    </ThemeProvider>
  )
}
