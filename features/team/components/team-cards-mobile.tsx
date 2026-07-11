'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RoleBadge }            from './role-badge'
import { SpecializationBadge }  from './specialization-badge'
import { TeamMemberActions }    from './team-member-actions'
import type { TeamMember, OrgRole } from '../types'

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

type Props = {
  members:    TeamMember[]
  viewerRole: OrgRole
  viewerId:   string
}

export function TeamCardsMobile({ members, viewerRole, viewerId }: Props) {
  const canSeeEmails = viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'project_manager'

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div
          key={m.id}
          className={`rounded-lg border p-3 ${m.is_active ? '' : 'opacity-50'}`}
        >
          {/* Top row: avatar, name/email, actions */}
          <div className="flex items-start gap-2.5">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={m.profile.avatar_url ?? ''} />
              <AvatarFallback className="text-xs">{initials(m.profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{m.profile.full_name ?? '—'}</p>
              {canSeeEmails && m.profile.email && (
                <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p>
              )}
            </div>
            <TeamMemberActions member={m} viewerRole={viewerRole} viewerId={viewerId} />
          </div>

          {/* Badges row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={m.role} />
            <SpecializationBadge specialization={m.specialization} />
            {m.is_active
              ? <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-[10px] px-1.5 py-0">Active</Badge>
              : <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">Inactive</Badge>}

            {/* Workload */}
            {(() => {
              const total = m.workload.active + m.workload.in_review
              if (total === 0) return null
              return (
                <span className="text-xs text-muted-foreground">
                  {total} task{total !== 1 ? 's' : ''}
                  {m.workload.overdue > 0 && (
                    <span className="text-destructive ml-1">({m.workload.overdue} overdue)</span>
                  )}
                </span>
              )
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}
