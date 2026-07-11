import { z } from 'zod'
import type { Project } from '@/types/project'

const FORM_STATUSES = ['planning', 'active', 'on_hold', 'review', 'completed', 'cancelled'] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

export const projectFormSchema = z
  .object({
    client_id: z.string().min(1, 'Please select a client'),
    name: z
      .string()
      .min(1, 'Project name is required')
      .max(200, 'Cannot exceed 200 characters'),
    description: z.string().max(2000, 'Cannot exceed 2000 characters').optional(),
    status: z.enum(FORM_STATUSES),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
    budget: z
      .string()
      .optional()
      .refine(
        (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 999_999_999),
        'Enter a valid budget amount (0–999,999,999)'
      ),
    progress: z.number().int().min(0).max(100),
    project_files_url: z
      .string()
      .optional()
      .refine(
        (v) => {
          if (!v || v.trim() === '') return true
          try {
            const url = new URL(v.trim())
            return url.protocol === 'https:' || url.protocol === 'http:'
          } catch {
            return false
          }
        },
        'Must be a valid http:// or https:// URL'
      ),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.due_date) return true
      return data.due_date >= data.start_date
    },
    { message: 'Due date must be on or after start date', path: ['due_date'] }
  )

export type ProjectFormValues = z.infer<typeof projectFormSchema>

/** Convert a DB project to form default values. */
export function projectToFormValues(project: Project): ProjectFormValues {
  const status: FormStatus = FORM_STATUSES.includes(project.status as FormStatus)
    ? (project.status as FormStatus)
    : 'active'
  return {
    client_id:         project.client_id,
    name:              project.name,
    description:       project.description ?? '',
    status,
    priority:          project.priority,
    start_date:        project.start_date ?? '',
    due_date:          project.due_date ?? '',
    budget:            project.budget !== null ? String(project.budget) : '',
    progress:          project.progress,
    project_files_url: project.project_files_url ?? '',
  }
}

/** Convert form values to DB-ready shape. */
export function formValuesToProjectData(values: ProjectFormValues) {
  const url = values.project_files_url?.trim() ?? ''
  return {
    client_id:         values.client_id,
    name:              values.name,
    description:       values.description || null,
    status:            values.status,
    priority:          values.priority,
    start_date:        values.start_date || null,
    due_date:          values.due_date || null,
    budget:            values.budget ? Number(values.budget) : null,
    progress:          values.progress,
    project_files_url: url || null,
  }
}
