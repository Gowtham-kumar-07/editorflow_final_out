import { z } from 'zod'
import type { Client } from '@/types/client'

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const clientFormSchema = z.object({
  company_name: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Cannot exceed 200 characters'),

  contact_name: z
    .string()
    .max(100, 'Cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),

  email: z
    .union([z.string().email('Invalid email address'), z.literal('')])
    .optional(),

  phone: z
    .string()
    .max(50, 'Cannot exceed 50 characters')
    .optional()
    .or(z.literal('')),

  website: z
    .string()
    .max(500, 'Cannot exceed 500 characters')
    .refine((v) => !v || /^https?:\/\//.test(v), 'Must start with http:// or https://')
    .optional()
    .or(z.literal('')),

  industry: z
    .string()
    .max(100, 'Cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(500, 'Cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),

  gst_tax_id: z
    .string()
    .max(50, 'Cannot exceed 50 characters')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .max(2000, 'Cannot exceed 2000 characters')
    .optional()
    .or(z.literal('')),

  status: z.enum(['active', 'inactive']),
})

// ─── Derived types ────────────────────────────────────────────────────────────

export type ClientFormValues = z.infer<typeof clientFormSchema>

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CLIENT_FORM_DEFAULTS: ClientFormValues = {
  company_name: '',
  contact_name: '',
  email:        '',
  phone:        '',
  website:      '',
  industry:     '',
  address:      '',
  gst_tax_id:   '',
  notes:        '',
  status:       'active',
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

/** DB row → form default values (null fields become empty strings). */
export function clientToFormValues(client: Client): ClientFormValues {
  return {
    company_name: client.company_name,
    contact_name: client.contact_name ?? '',
    email:        client.email        ?? '',
    phone:        client.phone        ?? '',
    website:      client.website      ?? '',
    industry:     client.industry     ?? '',
    address:      client.address      ?? '',
    gst_tax_id:   client.gst_tax_id   ?? '',
    notes:        client.notes        ?? '',
    // Archived clients fall back to 'active' so the edit form stays valid.
    status:       client.status === 'archived' ? 'active' : client.status,
  }
}

/** Form values → DB-ready shape (empty strings become null). */
export function formValuesToClientData(values: ClientFormValues) {
  return {
    company_name: values.company_name,
    contact_name: values.contact_name || null,
    email:        values.email        || null,
    phone:        values.phone        || null,
    website:      values.website      || null,
    industry:     values.industry     || null,
    address:      values.address      || null,
    gst_tax_id:   values.gst_tax_id   || null,
    notes:        values.notes        || null,
    status:       values.status,
  }
}
