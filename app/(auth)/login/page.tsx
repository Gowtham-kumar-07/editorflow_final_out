import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import { Separator } from '@/components/ui/separator'
import { LoginForm } from '@/features/auth/components/login-form'
import { isSafeRedirect } from '@/lib/safe-redirect'

export const metadata: Metadata = {
  title: 'Sign in',
}

type Props = {
  searchParams: Promise<{ next?: string }>
}

type InviteContext = {
  token:   string
  email:   string
  orgName: string
}

/**
 * Extracts and validates an invitation token from a safe next-path.
 * Returns null if the next param is not an invite path, or if the token is
 * invalid, expired, or already accepted.
 */
async function resolveInviteContext(safeNext: string | undefined): Promise<InviteContext | null> {
  if (!safeNext?.startsWith('/invite/accept?')) return null

  let token: string | null = null
  try {
    token = new URL(safeNext, 'http://localhost').searchParams.get('token')
  } catch {
    return null
  }
  if (!token) return null

  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: inv } = await admin
    .from('invitations')
    .select('email, expires_at, accepted_at, organization_id')
    .eq('token', token)
    .maybeSingle()

  if (!inv || inv.accepted_at || new Date(inv.expires_at) <= new Date()) {
    return null
  }

  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', inv.organization_id)
    .single()

  return {
    token,
    email:   inv.email,
    orgName: org?.name ?? 'your organization',
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  const safeNext = next && isSafeRedirect(next) ? next : undefined

  // Validate the invite token (if any) before showing invite-aware UI.
  // This prevents showing a "Create account" link for fake or expired tokens.
  const inviteCtx = await resolveInviteContext(safeNext)

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {inviteCtx ? 'Accept your invitation' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {inviteCtx
            ? `Sign in to join ${inviteCtx.orgName}, or create a new account below.`
            : 'Sign in to your account to continue'}
        </p>
      </div>

      <LoginForm next={safeNext} />

      <Separator className="my-6" />

      {inviteCtx ? (
        <p className="text-center text-sm text-muted-foreground">
          New to EditorFlow?{' '}
          <a
            href={`/signup?invite=${encodeURIComponent(inviteCtx.token)}&next=${encodeURIComponent(safeNext!)}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create account from your invitation
          </a>
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a
            href="mailto:admin@editorflow.app"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Contact your administrator
          </a>
        </p>
      )}
    </div>
  )
}
