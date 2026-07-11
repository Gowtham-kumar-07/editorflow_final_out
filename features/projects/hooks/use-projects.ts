'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { projectKeys } from '../queries/project-queries'
import { getProjects, getProject, updateProjectStatusAction } from '../actions'
import type { ProjectFilters } from '../types'
import type { ProjectStatus } from '@/types/supabase'

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey:  projectKeys.list(filters),
    queryFn:   () => getProjects(filters),
    staleTime: 30 * 1000,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey:  projectKeys.detail(id),
    queryFn:   () => getProject(id),
    staleTime: 30 * 1000,
    enabled:   !!id,
  })
}

export function useUpdateProjectStatus(projectId: string) {
  const queryClient = useQueryClient()
  const router      = useRouter()
  return useMutation({
    mutationFn: (newStatus: ProjectStatus) =>
      updateProjectStatusAction(projectId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      router.refresh()
    },
  })
}
