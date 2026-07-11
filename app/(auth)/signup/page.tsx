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

  // ── Invite-only guard ─────────────────────────────────────────────────────
  // EditorFlow is invite-only. A valid ?invite=<token> is required before the
  // signup form is shown. Without it, visitors see the invite-required notice.
  if (!token) {
    return <InviteGatePage />
  }

  // ── Server-side token validation ──────────────────────────────────────────
  // The invitation row is fetched with the service role so this works before
  // the visitor is authenticated. The email shown in the form comes from the
  // database, never from a query parameter.
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

  if (!inv) {
    return <InviteStatusPage type="not_found" />
  }

  if (inv.accepted_at) {
    return <InviteStatusPage type="accepted" />
  }

  if (new Date(inv.expires_at) <= new Date()) {
    return <InviteStatusPage type="expired" />
  }

  // ── Valid invitation ───────────────────────────────────────────────────────
  // After signup the user must return to the invite page to explicitly click
  // "Join Organization" — acceptance is never automatic.
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

// ── No-invite gate (shown when /signup is reached without a token) ─────────

function InviteGatePage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
      <h1 className="text-xl font-semibold">Invitation required</h1>
      <p className="text-sm text-muted-foreground">
        EditorFlow is invite-only. To create an account, use the link from your
        invitation or ask your organization administrator for a new invitation.
      </p>
      <Link
        href="/login"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Sign in to an existing account
      </Link>
    </div>
  )
}

// ── Specific invitation error states ──────────────────────────────────────

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
