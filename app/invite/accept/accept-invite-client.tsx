'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ROLE_LABELS, SPECIALIZATION_LABELS } from '@/features/team/types'
import type { InvitationDetails, OrgRole, TeamSpecialization } from '@/features/team/types'

type Props = {
  token:      string
  invitation: InvitationDetails
  /** null when the visitor is signed out */
  userEmail:  string | null
}

export function AcceptInviteClient({ token, invitation, userEmail }: Props) {
  const [accepting, setAccepting]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  const roleLabel = ROLE_LABELS[invitation.role as OrgRole] ?? invitation.role
  const specLabel = invitation.specialization
    ? (SPECIALIZATION_LABELS[invitation.specialization as TeamSpecialization] ??
       invitation.specialization)
    : null

  const emailMatches =
    userEmail !== null &&
    userEmail.toLowerCase() === invitation.email.toLowerCase()

  // Full invite URL including token — used in sign-in / sign-out / signup links
  const invitePath = `/invite/accept?token=${encodeURIComponent(token)}`

  // ── Accept invitation ──────────────────────────────────────────────────────
  async function accept() {
    setAccepting(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

    if (error) {
      toast.error(error.message)
      setAccepting(false)
      return
    }

    const result = data as { org_id: string; org_name: string; role: string }
    toast.success(`You've joined ${result.org_name}!`)
    router.push('/dashboard')
    router.refresh()
  }

  // ── Sign out current session and return to invitation ─────────────────────
  // Uses window.location (hard redirect) instead of router.push so the session
  // is fully cleared before the login page initialises.
  async function signOutAndContinue() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = `/login?next=${encodeURIComponent(invitePath)}`
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">You&apos;ve been invited</h1>
          <p className="text-sm text-muted-foreground">
            {invitation.invited_by_name
              ? `${invitation.invited_by_name} invited you to join`
              : 'You have been invited to join'}{' '}
            <strong>{invitation.org_name}</strong>.
          </p>
        </div>

        {/* ── Invitation details card ────────────────────────────────────────── */}
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

        {/* ── STATE 1: Signed out ────────────────────────────────────────────── */}
        {!userEmail && (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Sign in with <strong>{invitation.email}</strong> to accept this
              invitation.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <a href={`/login?next=${encodeURIComponent(invitePath)}`}>
                  Sign in
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`/signup?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(invitePath)}`}
                >
                  Create account
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* ── STATE 2: Wrong account signed in ──────────────────────────────── */}
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
              <Button
                onClick={signOutAndContinue}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out and continue'}
              </Button>
              <Button variant="ghost" asChild>
                <a href="/dashboard">Return to dashboard</a>
              </Button>
            </div>
          </div>
        )}

        {/* ── STATE 3: Correct account signed in ────────────────────────────── */}
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
