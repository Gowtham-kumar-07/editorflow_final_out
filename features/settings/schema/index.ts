import { z } from 'zod'

export const profileSchema = z.object({
  full_name:          z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  preferred_currency: z.string().min(3).max(3),
})

export const orgProfileSchema = z.object({
  name:           z.string().min(1, 'Organization name is required').max(100),
  tagline:        z.string().max(200).optional(),
  business_email: z.string().email('Invalid email').max(254).optional().or(z.literal('')),
  business_phone: z.string().max(50).optional(),
  website:        z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  address_line1:  z.string().max(200).optional(),
  address_line2:  z.string().max(200).optional(),
  city:           z.string().max(100).optional(),
  state:          z.string().max(100).optional(),
  postal_code:    z.string().max(20).optional(),
  country:        z.string().max(100).optional(),
  tax_id:         z.string().max(50).optional(),
})

export const financialDefaultsSchema = z.object({
  default_currency:           z.string().min(3).max(3, 'Must be a 3-letter ISO code'),
  default_payment_terms_days: z.number().int().min(0).max(365).nullable(),
  default_payroll_currency:   z.string().min(3).max(3, 'Must be a 3-letter ISO code'),
})

export const invoiceBrandingSchema = z.object({
  invoice_prefix:       z.string().min(1, 'Prefix is required').max(10),
  invoice_accent_color: z.string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #2563eb')
    .optional()
    .or(z.literal('')),
  invoice_footer_text: z.string().max(500).optional(),
  invoice_legal_text:  z.string().max(1000).optional(),
})

export const paymentDetailsSchema = z.object({
  bank_name:           z.string().max(100).optional(),
  bank_account_name:   z.string().max(100).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_ifsc:           z.string().max(20).optional(),
  bank_swift:          z.string().max(20).optional(),
  bank_branch:         z.string().max(100).optional(),
  upi_id:              z.string().max(100).optional(),
})

export type ProfileFormValues          = z.infer<typeof profileSchema>
export type OrgProfileFormValues       = z.infer<typeof orgProfileSchema>
export type FinancialDefaultsValues    = z.infer<typeof financialDefaultsSchema>
export type InvoiceBrandingValues      = z.infer<typeof invoiceBrandingSchema>
export type PaymentDetailsValues       = z.infer<typeof paymentDetailsSchema>
