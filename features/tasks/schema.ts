import { z } from 'zod'
import type { TaskWithDetails } from './types'

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const taskFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Cannot exceed 500 characters'),

  description: z
    .string()
    .max(5000, 'Cannot exceed 5000 characters')
    .optional()
    .or(z.literal('')),

  project_id: z
    .string()
    .min(1, 'Project is required'),

  assigned_to: z
    .string()
    .optional()
    .or(z.literal('')),

  status: z.enum(['todo', 'in_progress', 'review', 'completed', 'blocked']),

  priority: z.enum(['low', 'medium', 'high', 'urgent']),

  due_date: z
    .string()
    .optional()
    .or(z.literal('')),

  estimated_hours: z
    .string()
    .optional()
    .or(z.literal('')),

  amount: z
    .number()
    .min(0, 'Amount cannot be negative'),
})

// ─── Derived types ────────────────────────────────────────────────────────────

export type TaskFormValues = z.infer<typeof taskFormSchema>

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const TASK_FORM_DEFAULTS: TaskFormValues = {
  title:           '',
  description:     '',
  project_id:      '',
  assigned_to:     '',
  status:          'todo',
  priority:        'medium',
  due_date:        '',
  estimated_hours: '',
  amount:          0,
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function taskToFormValues(task: TaskWithDetails): TaskFormValues {
  return {
    title:           task.title,
    description:     task.description      ?? '',
    project_id:      task.project_id,
    assigned_to:     task.assigned_to      ?? '',
    status:          task.status,
    priority:        task.priority,
    due_date:        task.due_date         ?? '',
    estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : '',
    amount:          task.amount           ?? 0,
  }
}

export function formValuesToTaskData(values: TaskFormValues) {
  return {
    title:           values.title,
    description:     values.description     || null,
    project_id:      values.project_id,
    assigned_to:     values.assigned_to     || null,
    status:          values.status,
    priority:        values.priority,
    due_date:        values.due_date        || null,
    estimated_hours: values.estimated_hours ? Number(values.estimated_hours) : null,
    amount:          values.amount          ?? 0,
  }
}
