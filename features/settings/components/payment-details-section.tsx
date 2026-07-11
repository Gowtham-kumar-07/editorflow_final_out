'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SectionCard } from './section-card'
import { updatePaymentDetailsAction } from '../actions'
import { paymentDetailsSchema, type PaymentDetailsValues } from '../schema'
import { settingsKeys } from '../queries/settings-queries'
import type { OrgSettings } from '../types'

interface PaymentDetailsSectionProps {
  org: OrgSettings
}

export function PaymentDetailsSection({ org }: PaymentDetailsSectionProps) {
  const qc = useQueryClient()

  const form = useForm<PaymentDetailsValues>({
    resolver: zodResolver(paymentDetailsSchema),
    defaultValues: {
      bank_name:           org.bank_name           ?? '',
      bank_account_name:   org.bank_account_name   ?? '',
      bank_account_number: org.bank_account_number ?? '',
      bank_ifsc:           org.bank_ifsc           ?? '',
      bank_swift:          org.bank_swift           ?? '',
      bank_branch:         org.bank_branch          ?? '',
      upi_id:              org.upi_id               ?? '',
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const result = await updatePaymentDetailsAction(values)

    if (result.ok) {
      toast.success('Payment details saved')
      await qc.invalidateQueries({ queryKey: settingsKeys.page() })
      form.reset(values)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <SectionCard
      id="payment-details"
      title="Payment Details"
      description="Bank and UPI details printed on invoices for your clients."
      onSave={form.handleSubmit(handleSave)}
      saving={isSubmitting}
      dirty={isDirty}
    >
      <Form {...form}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="bank_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Name</FormLabel>
              <FormControl><Input placeholder="HDFC Bank" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="bank_branch" render={({ field }) => (
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <FormControl><Input placeholder="Andheri West, Mumbai" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="bank_account_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl><Input placeholder="Acme Studio Pvt Ltd" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="bank_account_number" render={({ field }) => (
            <FormItem>
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input placeholder="00123456789" inputMode="numeric" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="bank_ifsc" render={({ field }) => (
            <FormItem>
              <FormLabel>IFSC Code</FormLabel>
              <FormControl><Input placeholder="HDFC0001234" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="bank_swift" render={({ field }) => (
            <FormItem>
              <FormLabel>SWIFT / BIC Code</FormLabel>
              <FormControl><Input placeholder="HDFCINBB" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="upi_id" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>UPI ID</FormLabel>
              <FormControl><Input placeholder="studio@upi" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </Form>
    </SectionCard>
  )
}
