'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { teamKeys } from '../queries/team-queries'
import {
  getTeam,
  inviteMemberAction,
  updateMemberRoleAction,
  updateMemberSpecializationAction,
  deactivateMemberAction,
  reactivateMemberAction,
  cancelInvitationAction,
} from '../actions'
import type { InviteFormValues } from '../schema'
import type { OrgRole } from '../types'

const STALE = 30 * 1000

export function useTeam() {
  return useQuery({
    queryKey:        teamKeys.members(),
    queryFn:         () => getTeam(),
    staleTime:       STALE,
    placeholderData: (prev) => prev,
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: InviteFormValues) => inviteMemberAction(values),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      }
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      updateMemberRoleAction(userId, role),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Role updated')
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      } else {
        toast.error(result.error)
      }
    },
  })
}

export function useUpdateMemberSpecialization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, specialization }: { userId: string; specialization: string | null }) =>
      updateMemberSpecializationAction(userId, specialization),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Specialization updated')
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      } else {
        toast.error(result.error)
      }
    },
  })
}

export function useDeactivateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deactivateMemberAction(userId),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Member deactivated')
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      } else {
        toast.error(result.error)
      }
    },
  })
}

export function useReactivateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => reactivateMemberAction(userId),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Member reactivated')
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      } else {
        toast.error(result.error)
      }
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => cancelInvitationAction(invitationId),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Invitation cancelled')
        void queryClient.invalidateQueries({ queryKey: teamKeys.members() })
      } else {
        toast.error(result.error)
      }
    },
  })
}
