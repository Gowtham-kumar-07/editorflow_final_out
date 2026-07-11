import { z } from 'zod'

// ── Line item ─────────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
  _id:        z.string().optional(),
  project_id: z.string().nullable().optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description cannot exceed 500 characters'),
  quantity: z
    .number({ error: 'Enter a valid number' })
    .positive('Quantity must be greater than 0')
    .max(999_999, 'Quantity is too large'),
  unit_price: z
    .number({ error: 'Enter a valid number' })
    .min(0, 'Unit price cannot be negative')
    .max(999_999_999, 'Unit price is too large'),
})

// ── Invoice form ──────────────────────────────────────────────────────────────

export const invoiceFormSchema = z
  .object({
    client_id:   z.string().min(1, 'Please select a client'),
    project_ids: z.array(z.string()),   // multi-project; can be empty

    issue_date: z.string().min(1, 'Issue date is required'),
    due_date:   z.string().optional(),

    currency: z.string().min(1).max(3, 'Invalid currency code'),

    discount_type:  z.enum(['fixed', 'percent'] as const),
    discount_value: z.number().min(0, 'Discount cannot be negative'),
    tax_rate:       z
      .number()
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot exceed 100%'),

    notes:         z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
    payment_terms: z.string().max(200, 'Payment terms cannot exceed 200 characters').optional(),

    line_items: z
      .array(lineItemSchema)
      .min(1, 'At least one line item is required'),
  })
  .refine(
    (data) => {
      if (!data.due_date || !data.issue_date) return true
      return data.due_date >= data.issue_date
    },
    { message: 'Due date must be on or after the issue date', path: ['due_date'] }
  )
  .refine(
    (data) => {
      if (data.discount_type !== 'percent') return true
      return data.discount_value <= 100
    },
    { message: 'Percentage discount cannot exceed 100%', path: ['discount_value'] }
  )

export type InvoiceFormValues   = z.infer<typeof invoiceFormSchema>
export type LineItemFormValues  = z.infer<typeof lineItemSchema>

// ── Default form values ───────────────────────────────────────────────────────

export function defaultInvoiceValues(opts?: {
  defaultCurrency?:          string | null
  defaultPaymentTermsDays?:  number | null
}): InvoiceFormValues {
  const today = new Date().toISOString().slice(0, 10)
  const currency = opts?.defaultCurrency ?? 'USD'
  const termsDays = opts?.defaultPaymentTermsDays ?? null

  let dueDate = ''
  if (termsDays !== null && termsDays > 0) {
    const due = new Date()
    due.setDate(due.getDate() + termsDays)
    dueDate = due.toISOString().slice(0, 10)
  }

  const paymentTerms = termsDays !== null ? `Net ${termsDays}` : ''

  return {
    client_id:      '',
    project_ids:    [],
    issue_date:     today,
    due_date:       dueDate,
    currency,
    discount_type:  'fixed',
    discount_value: 0,
    tax_rate:       0,
    notes:          '',
    payment_terms:  paymentTerms,
    line_items:     [{ description: '', quantity: 1, unit_price: 0, project_id: null }],
  }
}
