import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/supabase/server'
import { getUserOrganization } from '@/services/organization.service'
import { OrgWizard } from '@/features/onboarding/components/org-wizard'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Set up your organization',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Already belongs to an organization — send straight to the app
  const existing = await getUserOrganization(supabase, user.id)
  if (existing) redirect('/dashboard')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Zap className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Set up your organization</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This takes about a minute. You can update everything later in Settings.
          </p>
        </div>

        <OrgWizard />
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground">
        Logged in as{' '}
        <span className="font-medium text-foreground">{user.email}</span>
        {' · '}
        <a href="/api/auth/signout" className="underline underline-offset-4 hover:text-foreground">
          Sign out
        </a>
      </p>
    </div>
  )
}
