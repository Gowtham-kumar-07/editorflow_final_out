'use client'

import { useQuery } from '@tanstack/react-query'
import { projectKeys } from '../queries/project-queries'
import {
  getProjectStats,
  getProjectTasksPreview,
  getProjectTeam,
  getProjectActivity,
} from '../actions/workspace'

const STALE = 30 * 1000

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: projectKeys.stats(projectId),
    queryFn:  () => getProjectStats(projectId),
    staleTime: STALE,
    enabled:  !!projectId,
  })
}

export function useProjectTasksPreview(projectId: string) {
  return useQuery({
    queryKey: projectKeys.tasks(projectId),
    queryFn:  () => getProjectTasksPreview(projectId),
    staleTime: STALE,
    enabled:  !!projectId,
  })
}

export function useProjectTeam(projectId: string) {
  return useQuery({
    queryKey: projectKeys.team(projectId),
    queryFn:  () => getProjectTeam(projectId),
    staleTime: STALE,
    enabled:  !!projectId,
  })
}

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: projectKeys.activity(projectId),
    queryFn:  () => getProjectActivity(projectId),
    staleTime: STALE,
    enabled:  !!projectId,
  })
}
