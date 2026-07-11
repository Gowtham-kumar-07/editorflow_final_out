import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { TaskFilters, GetTasksResult, TaskWithDetails, TaskComment, TaskActivity, OrgMember, ProjectOption } from '../types'
import { formValuesToTaskData, type TaskFormValues } from '../schema'
import {
  dbFindTasks,
  dbFindTaskById,
  dbCreateTask,
  dbUpdateTask,
  dbArchiveTask,
  dbTransitionTaskStatus,
  dbLogTaskActivity,
  dbCreateTaskComment,
  dbGetTaskComments,
  dbGetTaskActivityLogs,
  dbGetOrgMembers,
  dbGetProjectOptions,
} from '../repository/task.repository'
import type { TaskStatus } from '../types'

type TypedClient = SupabaseClient<Database>
type TaskRow     = Database['public']['Tables']['tasks']['Row']

export const TASK_PAGE_SIZE = 20

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(
  supabase: TypedClient,
  organizationId: string,
  filters: TaskFilters = {}
): Promise<GetTasksResult> {
  const pageSize = filters.pageSize ?? TASK_PAGE_SIZE
  const page     = filters.page     ?? 1

  const { rows, count } = await dbFindTasks(supabase, organizationId, { ...filters, pageSize })

  return {
    tasks:      rows,
    total:      count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  }
}

export async function fetchTaskById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<TaskWithDetails | null> {
  return dbFindTaskById(supabase, id, organizationId)
}

export async function fetchTaskComments(
  supabase: TypedClient,
  taskId: string
): Promise<TaskComment[]> {
  return dbGetTaskComments(supabase, taskId)
}

export async function fetchTaskActivity(
  supabase: TypedClient,
  taskId: string,
  organizationId: string
): Promise<TaskActivity[]> {
  return dbGetTaskActivityLogs(supabase, taskId, organizationId)
}

export async function fetchOrgMembers(
  supabase: TypedClient,
  organizationId: string
): Promise<OrgMember[]> {
  return dbGetOrgMembers(supabase, organizationId)
}

export async function fetchProjectOptions(
  supabase: TypedClient,
  organizationId: string
): Promise<ProjectOption[]> {
  return dbGetProjectOptions(supabase, organizationId)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTaskService(
  supabase: TypedClient,
  organizationId: string,
  userId: string,
  values: TaskFormValues
): Promise<TaskRow> {
  const data = formValuesToTaskData(values)
  const task = await dbCreateTask(supabase, {
    ...data,
    organization_id: organizationId,
  })

  await dbLogTaskActivity(supabase, organizationId, task.id, 'created', {
    title: task.title,
  })

  return task
}

export async function updateTaskService(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  values: TaskFormValues
): Promise<TaskRow> {
  const data = formValuesToTaskData(values)
  const task = await dbUpdateTask(supabase, id, organizationId, data)

  await dbLogTaskActivity(supabase, organizationId, id, 'updated', {
    title: task.title,
  })

  return task
}

export async function archiveTaskService(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  title: string
): Promise<void> {
  await dbArchiveTask(supabase, id, organizationId)
  await dbLogTaskActivity(supabase, organizationId, id, 'deleted', { title })
}

export async function transitionTaskStatusService(
  supabase: TypedClient,
  taskId: string,
  organizationId: string,
  newStatus: TaskStatus
): Promise<void> {
  // Fetch current status for meaningful activity log
  const current = await dbFindTaskById(supabase, taskId, organizationId)
  const previousStatus = current?.status

  // RPC validates role + assignee + allowed transition at the DB layer
  await dbTransitionTaskStatus(supabase, taskId, newStatus)

  // Map transition to a human-readable action label
  let action = 'status_changed'
  if (newStatus === 'in_progress' && previousStatus === 'todo')        action = 'task_started'
  else if (newStatus === 'review')                                      action = 'submitted_for_review'
  else if (newStatus === 'completed')                                   action = 'task_approved'
  else if (newStatus === 'in_progress' && previousStatus === 'review') action = 'revision_requested'
  else if (newStatus === 'in_progress' && previousStatus === 'completed') action = 'task_reopened'

  const activityType = newStatus === 'completed' ? 'completed' : 'updated'
  await dbLogTaskActivity(supabase, organizationId, taskId, activityType, {
    action,
    previous_status: previousStatus ?? null,
    new_status:      newStatus,
  })
}

export async function addCommentService(
  supabase: TypedClient,
  organizationId: string,
  taskId: string,
  userId: string,
  comment: string
): Promise<void> {
  await dbCreateTaskComment(supabase, taskId, userId, comment)
  await dbLogTaskActivity(supabase, organizationId, taskId, 'commented', {
    preview: comment.slice(0, 100),
  })
}
