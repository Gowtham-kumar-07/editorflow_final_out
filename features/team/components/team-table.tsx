'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

export function TeamTable({ members, viewerRole, viewerId }: Props) {
  const canSeeEmails = viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'project_manager'

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Member</TableHead>
            <TableHead className="w-[130px]">Role</TableHead>
            <TableHead className="w-[150px]">Specialization</TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Workload</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id} className={m.is_active ? '' : 'opacity-50'}>
              {/* Member */}
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={m.profile.avatar_url ?? ''} />
                    <AvatarFallback className="text-[10px]">
                      {initials(m.profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link href={`/team/${m.id}`} className="truncate text-sm font-medium leading-tight hover:underline">
                      {m.profile.full_name ?? '—'}
                    </Link>
                    {canSeeEmails && m.profile.email && (
                      <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p>
                    )}
                  </div>
                </div>
              </TableCell>

              {/* Role */}
              <TableCell>
                <RoleBadge role={m.role} />
              </TableCell>

              {/* Specialization */}
              <TableCell>
                <SpecializationBadge specialization={m.specialization} />
              </TableCell>

              {/* Status */}
              <TableCell>
                {m.is_active
                  ? <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Active</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
              </TableCell>

              {/* Workload */}
              <TableCell className="text-right">
                <WorkloadCell workload={m.workload} />
              </TableCell>

              {/* Actions */}
              <TableCell>
                <TeamMemberActions member={m} viewerRole={viewerRole} viewerId={viewerId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function WorkloadCell({ workload }: { workload: TeamMember['workload'] }) {
  const total = workload.active + workload.in_review
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="text-right">
      <span className="text-sm font-medium tabular-nums">{total}</span>
      <span className="text-xs text-muted-foreground ml-1">task{total !== 1 ? 's' : ''}</span>
      {workload.overdue > 0 && (
        <p className="text-xs text-destructive">{workload.overdue} overdue</p>
      )}
    </div>
  )
}
