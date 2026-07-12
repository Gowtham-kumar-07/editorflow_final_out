'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { switchOrganizationAction } from '@/features/orgs/actions'
import { ROLE_LABELS, SPECIALIZATION_LABELS } from '@/features/team/types'
import type { InvitationDetails, OrgRole, TeamSpecialization } from '@/features/team/types'

type Props = {
  token:          string
  invitation:     InvitationDetails
  /** null when the visitor is signed out */
  userEmail:      string | null
  /** The org they are currently active in (null for new users with no org) */
  currentOrgName: string | null
}

type AcceptedState = { orgId: string; orgName: string }

export function AcceptInviteClient({ token, invitation, userEmail, currentOrgName }: Props) {
  const [accepting, setAccepting]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [switching, setSwitching]   = useState(false)
  const [accepted, setAccepted]     = useState<AcceptedState | null>(null)

  const roleLabel = ROLE_LABELS[invitation.role as OrgRole] ?? invitation.role
  const specLabel = invitation.specialization
    ? (SPECIALIZATION_LABELS[invitation.specialization as TeamSpecialization] ??
       invitation.specialization)
    : null

  const emailMatches =
    userEmail !== null &&
    userEmail.toLowerCase() === invitation.email.toLowerCase()

  const invitePath = `/invite/accept?token=${encodeURIComponent(token)}`

  // ── Accept invitation ──────────────────────────────────────────────────────
  async function accept() {
    setAccepting(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

    if (error) {
      toast.error('Could not accept invitation. It may have expired.')
      setAccepting(false)
      return
    }

    const result = data as { org_id: string; org_name: string; role: string }
    setAccepted({ orgId: result.org_id, orgName: result.org_name })
    setAccepting(false)
  }

  // ── Switch to the newly joined org ────────────────────────────────────────
  async function switchToNewOrg() {
    if (!accepted) return
    setSwitching(true)
    const { error } = await switchOrganizationAction(accepted.orgId)
    if (error) {
      toast.error(error)
      setSwitching(false)
      return
    }
    // Hard navigate — we're outside the dashboard layout so there is no
    // React Query client to clear; a full reload fetches fresh org context.
    window.location.href = '/dashboard'
  }

  // ── Sign out and return to invitation ─────────────────────────────────────
  async function signOutAndContinue() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = `/login?next=${encodeURIComponent(invitePath)}`
  }

  // ── STATE: Accepted ────────────────────────────────────────────────────────
  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Invitation accepted!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve joined <strong>{accepted.orgName}</strong>.
              </p>
            </div>
          </div>

          {/* Show current org only when the user already had one before accepting */}
          {currentOrgName && currentOrgName !== accepted.orgName && (
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-muted-foreground">Current organization</span>
                <span className="font-medium">{currentOrgName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-muted-foreground">New organization</span>
                <span className="font-medium">{accepted.orgName}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button className="w-full" onClick={switchToNewOrg} disabled={switching}>
              {switching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Switch to {accepted.orgName}
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">You&apos;ve been invited</h1>
          <p className="text-sm text-muted-foreground">
            {invitation.invited_by_name
              ? `${invitation.invited_by_name} invited you to join`
              : 'You have been invited to join'}{' '}
            <strong>{invitation.org_name}</strong>.
          </p>
        </div>

        {/* ── Invitation details card ──────────────────────────────────────── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-medium">{invitation.org_name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline">{roleLabel}</Badge>
          </div>
          {specLabel && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Specialization</span>
              <Badge variant="secondary">{specLabel}</Badge>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Invited email</span>
            <span className="font-mono text-xs">{invitation.email}</span>
          </div>
        </div>

        {/* ── STATE 1: Signed out ──────────────────────────────────────────── */}
        {!userEmail && (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Sign in with <strong>{invitation.email}</strong> to accept this
              invitation.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <a href={`/login?next=${encodeURIComponent(invitePath)}`}>Sign in</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/signup?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(invitePath)}`}>
                  Create account
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* ── STATE 2: Wrong account ───────────────────────────────────────── */}
        {userEmail && !emailMatches && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>
                This invitation was sent to{' '}
                <strong>{invitation.email}</strong> but you are signed in as{' '}
                <strong>{userEmail}</strong>.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Button onClick={signOutAndContinue} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out and continue'}
              </Button>
              <Button variant="ghost" asChild>
                <a href="/dashboard">Return to dashboard</a>
              </Button>
            </div>
          </div>
        )}

        {/* ── STATE 3: Correct account ─────────────────────────────────────── */}
        {userEmail && emailMatches && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="font-mono text-xs">{userEmail}</span>
            </div>
            <Button className="w-full" onClick={accept} disabled={accepting}>
              {accepting ? 'Joining…' : `Join ${invitation.org_name}`}
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
