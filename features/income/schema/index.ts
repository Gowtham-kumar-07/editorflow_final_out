import { z } from 'zod'

export const markPaidSchema = z.object({
  payment_date:           z.string().min(1, 'Payment date is required'),
  payment_method:         z.string().min(1, 'Payment method is required').max(100),
  transaction_reference:  z.string().max(200).optional().or(z.literal('')),
  notes:                  z.string().max(1000).optional().or(z.literal('')),
})

export type MarkPaidValues = z.infer<typeof markPaidSchema>
