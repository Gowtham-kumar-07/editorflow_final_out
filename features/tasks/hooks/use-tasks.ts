'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskKeys } from '../queries/task-queries'
import { projectKeys } from '@/features/projects/queries/project-queries'
import {
  getTasks,
  getTask,
  getTaskComments,
  getTaskActivity,
  archiveTaskAction,
  transitionTaskStatusAction,
  addTaskCommentAction,
  getTaskIncomeAction,
} from '../actions'
import type { TaskFilters, TaskWithDetails, TaskStatus } from '../types'

const STALE = 30 * 1000

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey:        taskKeys.list(filters),
    queryFn:         () => getTasks(filters),
    staleTime:       STALE,
    placeholderData: (prev) => prev,
  })
}

export function useTask(
  id: string,
  options?: { initialData?: TaskWithDetails | null }
) {
  return useQuery({
    queryKey:    taskKeys.detail(id),
    queryFn:     () => getTask(id),
    staleTime:   STALE,
    enabled:     !!id,
    initialData: options?.initialData ?? undefined,
  })
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey:  taskKeys.comments(taskId),
    queryFn:   () => getTaskComments(taskId),
    staleTime: STALE,
    enabled:   !!taskId,
  })
}

export function useTaskActivity(taskId: string) {
  return useQuery({
    queryKey:  taskKeys.activity(taskId),
    queryFn:   () => getTaskActivity(taskId),
    staleTime: STALE,
    enabled:   !!taskId,
  })
}

export function useArchiveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string; projectId?: string }) =>
      archiveTaskAction(id, title),
    onSuccess: (_result, { id, projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) })
        queryClient.invalidateQueries({ queryKey: projectKeys.stats(projectId) })
      }
    },
  })
}

export function useTransitionTaskStatus(taskId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newStatus: TaskStatus) => transitionTaskStatusAction(taskId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats(projectId) })
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(taskId) })
    },
  })
}

export function useTaskIncome(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey:  ['task-income', taskId],
    queryFn:   () => getTaskIncomeAction(taskId),
    enabled:   enabled && !!taskId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAddTaskComment(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (comment: string) => addTaskCommentAction(taskId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) })
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(taskId) })
    },
  })
}
