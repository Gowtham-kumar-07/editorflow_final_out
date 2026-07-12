import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Database } from '@/types/supabase'
import { AcceptInviteClient } from './accept-invite-client'
import { getUserOrganization } from '@/services/organization.service'
import type { InvitationDetails } from '@/features/team/types'

export const metadata: Metadata = { title: 'Accept invitation' }

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) redirect('/')

  // ── Fetch invitation details with service role ────────────────────────────
  // Uses the service role so that unauthenticated visitors can still see the
  // invitation details (org name, role, email) and understand what they're
  // being invited to before signing in or creating an account.
  // The actual acceptance still requires a matching authenticated session.
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Query the invitations table directly (service role bypasses RLS).
  // We fetch even expired/accepted rows so we can show a specific error state.
  const { data: rawInv } = await admin
    .from('invitations')
    .select('id, email, role, specialization, expires_at, accepted_at, organization_id, invited_by')
    .eq('token', token)
    .maybeSingle()

  // ── Token does not exist ──────────────────────────────────────────────────
  if (!rawInv) {
    return <InviteErrorPage type="not_found" />
  }

  // ── Already accepted ──────────────────────────────────────────────────────
  if (rawInv.accepted_at) {
    return <InviteErrorPage type="accepted" />
  }

  // ── Expired or cancelled (cancel_invitation sets expires_at to the past) ──
  if (new Date(rawInv.expires_at) <= new Date()) {
    return <InviteErrorPage type="expired" />
  }

  // ── Valid invitation — enrich with org name and inviter name ─────────────
  const [{ data: org }, { data: inviterProfile }] = await Promise.all([
    admin
      .from('organizations')
      .select('name')
      .eq('id', rawInv.organization_id)
      .single(),
    rawInv.invited_by
      ? admin
          .from('profiles')
          .select('full_name')
          .eq('id', rawInv.invited_by)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const invitation: InvitationDetails = {
    id:              rawInv.id,
    email:           rawInv.email,
    role:            rawInv.role,
    specialization:  rawInv.specialization ?? null,
    expires_at:      rawInv.expires_at,
    org_name:        org?.name ?? 'Unknown Organization',
    invited_by_name: inviterProfile?.full_name ?? null,
  }

  // ── Resolve current auth state + active org ──────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch the user's current active org so the success page can display it
  const currentOrg = user ? await getUserOrganization(supabase, user.id) : null

  return (
    <AcceptInviteClient
      token={token}
      invitation={invitation}
      userEmail={user?.email ?? null}
      currentOrgName={currentOrg?.name ?? null}
    />
  )
}

// ── Error states (server-rendered, no client JS needed) ────────────────────

type InviteErrorType = 'not_found' | 'accepted' | 'expired'

function InviteErrorPage({ type }: { type: InviteErrorType }) {
  const content = {
    not_found: {
      title: 'Invitation not found',
      body:  'This invitation link is invalid or does not exist.',
      cta:   null,
    },
    accepted: {
      title: 'Invitation already accepted',
      body:  'This invitation has already been used.',
      cta:   { label: 'Go to Dashboard', href: '/dashboard' },
    },
    expired: {
      title: 'Invitation expired',
      body:  'This invitation is no longer valid. Ask your organization administrator to send a new one.',
      cta:   null,
    },
  }[type]

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">{content.title}</h1>
        <p className="text-sm text-muted-foreground">{content.body}</p>
        {content.cta && (
          <a
            href={content.cta.href}
            className="inline-block text-sm font-medium underline underline-offset-4"
          >
            {content.cta.label}
          </a>
        )}
      </div>
    </div>
  )
}
