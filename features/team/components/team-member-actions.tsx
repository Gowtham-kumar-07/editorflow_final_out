'use client'

import { useState } from 'react'
import { MoreHorizontal, UserCheck, UserX, ShieldCheck } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useUpdateMemberRole, useUpdateMemberSpecialization, useDeactivateMember, useReactivateMember } from '../hooks/use-team'
import { ROLE_LABELS, SPECIALIZATION_LABELS } from '../types'
import type { TeamMember, OrgRole, TeamSpecialization } from '../types'

const ASSIGNABLE_ROLES: OrgRole[] = ['admin', 'project_manager', 'member']
const SPECIALIZATIONS: TeamSpecialization[] = ['editor', 'designer', 'photographer', 'videographer', 'other']

type Props = {
  member:    TeamMember
  viewerRole: OrgRole
  viewerId:   string
}

export function TeamMemberActions({ member, viewerRole, viewerId }: Props) {
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const roleMutation    = useUpdateMemberRole()
  const specMutation    = useUpdateMemberSpecialization()
  const deactivateMut   = useDeactivateMember()
  const reactivateMut   = useReactivateMember()

  const isOwner       = viewerRole === 'owner'
  const isAdmin       = viewerRole === 'admin'
  const canManage     = isOwner || isAdmin
  const isSelf        = member.user_id === viewerId
  const targetIsOwner = member.role === 'owner'
  const targetIsAdmin = member.role === 'admin'

  // Admins cannot manage owners or other admins
  const canChangeRole = canManage && !isSelf && !targetIsOwner && !(isAdmin && targetIsAdmin)
  const canToggleActive = canManage && !isSelf && !targetIsOwner

  if (!canManage || isSelf) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-3.5 w-3.5" />
            <span className="sr-only">Member actions</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {member.profile.full_name ?? member.profile.email ?? 'Member'}
          </DropdownMenuLabel>

          {canChangeRole && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                  Change role
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {ASSIGNABLE_ROLES.map((r) => {
                    const disabled = r === member.role || (isAdmin && r === 'admin')
                    return (
                      <DropdownMenuItem
                        key={r}
                        disabled={disabled || roleMutation.isPending}
                        onSelect={() => roleMutation.mutate({ userId: member.user_id, role: r })}
                      >
                        {ROLE_LABELS[r]}
                        {r === member.role && ' ✓'}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Specialization</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    disabled={member.specialization === null || specMutation.isPending}
                    onSelect={() => specMutation.mutate({ userId: member.user_id, specialization: null })}
                  >
                    None
                    {member.specialization === null && ' ✓'}
                  </DropdownMenuItem>
                  {SPECIALIZATIONS.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === member.specialization || specMutation.isPending}
                      onSelect={() => specMutation.mutate({ userId: member.user_id, specialization: s })}
                    >
                      {SPECIALIZATION_LABELS[s]}
                      {s === member.specialization && ' ✓'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}

          {canToggleActive && (
            <>
              <DropdownMenuSeparator />
              {member.is_active ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={deactivateMut.isPending}
                  onSelect={() => setDeactivateOpen(true)}
                >
                  <UserX className="mr-2 h-3.5 w-3.5" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={reactivateMut.isPending}
                  onSelect={() => reactivateMut.mutate(member.user_id)}
                >
                  <UserCheck className="mr-2 h-3.5 w-3.5" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate member?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.profile.full_name ?? member.profile.email ?? 'This member'} will lose access to the
              organization immediately. You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deactivateMut.mutate(member.user_id)
                setDeactivateOpen(false)
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
