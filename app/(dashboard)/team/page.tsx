'use client'

import { useQuery } from '@tanstack/react-query'
import { PageContainer }       from '@/components/layout'
import { teamKeys }            from '@/features/team/queries/team-queries'
import { getTeam, getMyRoleAction } from '@/features/team/actions'
import {
  TeamTable,
  TeamCardsMobile,
  TeamTableSkeleton,
  InviteMemberDialog,
  PendingInvitations,
} from '@/features/team/components'
import { canInviteMembers } from '@/lib/permissions'
import type { OrgRole }     from '@/features/team/types'

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useMyRole() {
  return useQuery({
    queryKey:  ['myRole'],
    queryFn:   () => getMyRoleAction(),
    staleTime: 60 * 1000,
  })
}

function useTeamData() {
  return useQuery({
    queryKey:        teamKeys.members(),
    queryFn:         () => getTeam(),
    staleTime:       30 * 1000,
    placeholderData: (prev) => prev,
  })
}

// ─── Role ordering for sort ───────────────────────────────────────────────────

const ROLE_ORDER: Record<OrgRole, number> = {
  owner: 0, admin: 1, project_manager: 2, member: 3,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const roleQuery = useMyRole()
  const teamQuery = useTeamData()

  const roleResult  = roleQuery.data
  const userRole    = (roleResult?.ok ? roleResult.data.role  : 'member') as OrgRole
  const userId      = roleResult?.ok  ? roleResult.data.userId : ''

  const isLoading = roleQuery.isLoading || teamQuery.isLoading
  const members     = teamQuery.data?.members     ?? []
  const invitations = teamQuery.data?.invitations ?? []
  const activeCount = members.filter((m) => m.is_active).length

  const sorted = [...members].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    const rd = (ROLE_ORDER[a.role] ?? 4) - (ROLE_ORDER[b.role] ?? 4)
    if (rd !== 0) return rd
    return (a.profile.full_name ?? '').localeCompare(b.profile.full_name ?? '')
  })

  return (
    <PageContainer
      title="Team"
      description="Manage your organization members and invitations."
      actions={canInviteMembers(userRole) ? <InviteMemberDialog /> : undefined}
    >
      {/* Summary */}
      <p className="mb-4 text-sm text-muted-foreground">
        {isLoading ? '…' : `${activeCount} active member${activeCount !== 1 ? 's' : ''}`}
      </p>

      {/* Pending invitations (owner/admin only) */}
      {canInviteMembers(userRole) && invitations.length > 0 && (
        <div className="mb-4">
          <PendingInvitations invitations={invitations} />
        </div>
      )}

      {/* Team list */}
      {isLoading ? (
        <TeamTableSkeleton />
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <TeamTable members={sorted} viewerRole={userRole} viewerId={userId} />
          </div>
          <div className="md:hidden">
            <TeamCardsMobile members={sorted} viewerRole={userRole} viewerId={userId} />
          </div>
        </>
      )}
    </PageContainer>
  )
}
