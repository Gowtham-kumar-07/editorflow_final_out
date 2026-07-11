'use client'

import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useProjectTeam } from '../../hooks/use-project-workspace'
import { TeamSkeleton } from './skeletons'
import type { ProjectMemberRole } from '../../types/workspace'

const ROLE_LABEL: Record<ProjectMemberRole, string> = {
  manager: 'Manager',
  editor:  'Editor',
  viewer:  'Viewer',
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProjectTeamCard({ projectId }: { projectId: string }) {
  const { data: result, isPending } = useProjectTeam(projectId)

  if (isPending) return <TeamSkeleton />

  const members = result?.ok ? result.data : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Team</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  {member.profile?.avatar_url && (
                    <AvatarImage src={member.profile.avatar_url} />
                  )}
                  <AvatarFallback className="text-xs">
                    {initials(member.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.profile?.full_name ?? 'Unknown'}
                  </p>
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {ROLE_LABEL[member.role]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
