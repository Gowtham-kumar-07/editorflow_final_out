import { z } from 'zod'

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
