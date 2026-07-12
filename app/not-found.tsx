import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <span className="text-xl font-bold text-muted-foreground">404</span>
      </div>
      <h1 className="mt-5 text-lg font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button size="sm" className="mt-6 gap-2" asChild>
        <Link href="/dashboard">
          <LayoutDashboard className="h-4 w-4" />
          Go to dashboard
        </Link>
      </Button>
    </div>
  )
}
