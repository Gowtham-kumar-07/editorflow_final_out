import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { SignupForm } from '@/features/auth/components/signup-form'
import { isSafeRedirect } from '@/lib/safe-redirect'

export const metadata: Metadata = {
  title: 'Create account',
}

type Props = {
  searchParams: Promise<{ invite?: string; next?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { invite: token, next } = await searchParams

  // ── Invite path: requires valid token ─────────────────────────────────────
  if (token) {
    return <InviteSignupPage token={token} next={next} />
  }

  // ── Self-service path: no token required ──────────────────────────────────
  const safeNext = next && isSafeRedirect(next) ? next : '/onboarding'

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Start your free 14-day trial. No credit card required.
        </p>
      </div>

      <SignupForm next={safeNext} />

      <Separator className="my-6" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

// ── Invite-token signup flow ───────────────────────────────────────────────────

async function InviteSignupPage({ token, next }: { token: string; next?: string }) {
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: inv } = await admin
    .from('invitations')
    .select('id, email, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!inv)             return <InviteStatusPage type="not_found" />
  if (inv.accepted_at)  return <InviteStatusPage type="accepted" />
  if (new Date(inv.expires_at) <= new Date()) return <InviteStatusPage type="expired" />

  const invitePath = `/invite/accept?token=${encodeURIComponent(token)}`
  const safeNext   = next && isSafeRedirect(next) ? next : invitePath

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Complete your account setup to accept the invitation.
        </p>
      </div>

      {/* Email is sourced from the validated invitation row, not from any query param */}
      <SignupForm email={inv.email} next={safeNext} />

      <Separator className="my-6" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(safeNext)}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

// ── Invitation error states ────────────────────────────────────────────────────

type InviteStatusType = 'not_found' | 'accepted' | 'expired'

function InviteStatusPage({ type }: { type: InviteStatusType }) {
  const content = {
    not_found: {
      title: 'Invitation not found',
      body:  'This invitation link is invalid or does not exist.',
      cta:   null,
    },
    accepted: {
      title: 'Invitation already accepted',
      body:  'This invitation has already been used. If you have an account, sign in below.',
      cta:   { label: 'Sign in', href: '/login' },
    },
    expired: {
      title: 'Invitation expired',
      body:  'This invitation is no longer valid. Ask your organization administrator to send a new one.',
      cta:   null,
    },
  }[type]

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
      <h1 className="text-xl font-semibold">{content.title}</h1>
      <p className="text-sm text-muted-foreground">{content.body}</p>
      {content.cta && (
        <Link
          href={content.cta.href}
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          {content.cta.label}
        </Link>
      )}
    </div>
  )
}
