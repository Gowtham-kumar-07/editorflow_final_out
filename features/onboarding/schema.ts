import { z } from 'zod'

// ─── Kept for backward-compat with OrganizationForm ──────────────────────────

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Cannot exceed 50 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Cannot exceed 50 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Only lowercase letters, numbers, and hyphens are allowed'
    )
    .trim(),
  logoFile: z
    .custom<File>(
      (val) => typeof File === 'undefined' || val instanceof File,
      { message: 'Please upload a valid image file' }
    )
    .refine((f) => f.size <= 2 * 1024 * 1024, 'Logo must be smaller than 2 MB')
    .refine(
      (f) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type),
      'Only JPEG, PNG, WebP, or GIF images are allowed'
    )
    .optional()
    .nullable(),
})

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>

// ─── Multi-step wizard schemas ────────────────────────────────────────────────

const logoFileSchema = z
  .custom<File>(
    (val) => typeof File === 'undefined' || val instanceof File,
    { message: 'Please upload a valid image file' }
  )
  .refine((f) => f.size <= 2 * 1024 * 1024, 'Logo must be smaller than 2 MB')
  .refine(
    (f) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type),
    'Only JPEG, PNG, WebP, or GIF images are allowed'
  )
  .optional()
  .nullable()

export const orgWizardStep1Schema = z.object({
  name: z
    .string()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Cannot exceed 50 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Must be at least 2 characters')
    .max(50, 'Cannot exceed 50 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Only lowercase letters, numbers, and hyphens are allowed'
    )
    .trim(),
  logoFile: logoFileSchema,
})

export const orgWizardStep2Schema = z.object({
  defaultCurrency: z
    .string()
    .min(1, 'Required')
    .max(3, 'Must be a 3-letter ISO code')
    .regex(/^[A-Za-z]{3}$/, 'Must be a 3-letter currency code (e.g. USD, EUR, INR)'),
  payrollCurrency: z
    .string()
    .min(1, 'Required')
    .max(3, 'Must be a 3-letter ISO code')
    .regex(/^[A-Za-z]{3}$/, 'Must be a 3-letter currency code (e.g. USD, EUR, INR)'),
  timezone: z.string().min(1, 'Required'),
  dateFormat: z.string().min(1, 'Required'),
})

export const orgWizardSchema = orgWizardStep1Schema.merge(orgWizardStep2Schema)

export type OrgWizardStep1Values = z.infer<typeof orgWizardStep1Schema>
export type OrgWizardStep2Values = z.infer<typeof orgWizardStep2Schema>
export type OrgWizardValues     = z.infer<typeof orgWizardSchema>
