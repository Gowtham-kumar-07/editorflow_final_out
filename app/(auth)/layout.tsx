import type { ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Zap className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
      </div>

      {/* Page content */}
      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </p>
    </div>
  )
}
