import { z } from 'zod'

export const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cash', 'card', 'cheque', 'other'] as const
export type PaymentMethodValue = typeof PAYMENT_METHODS[number]

export const recordPaymentSchema = z.object({
  amount:          z.number().positive({ message: 'Amount must be greater than 0' }),
  payment_date:    z.string().min(1, 'Payment date is required'),
  payment_method:  z.enum(PAYMENT_METHODS, { message: 'Select a payment method' }),
  transaction_ref: z.string().optional(),
  notes:           z.string().optional(),
})

export const voidPaymentSchema = z.object({
  void_reason: z.string().min(1, 'Reason is required'),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
export type VoidPaymentInput   = z.infer<typeof voidPaymentSchema>
