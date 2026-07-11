import { z } from 'zod'

const INVITABLE_ROLES = ['admin', 'project_manager', 'member'] as const
const SPECIALIZATIONS = ['editor', 'designer', 'photographer', 'videographer', 'other'] as const

export const inviteSchema = z.object({
  email:          z.string().email('Enter a valid email address'),
  role:           z.enum(INVITABLE_ROLES),
  specialization: z.enum(SPECIALIZATIONS).optional(),
})

export type InviteFormValues = z.infer<typeof inviteSchema>

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'project_manager', 'member'] as const),
})

export type ChangeRoleValues = z.infer<typeof changeRoleSchema>
