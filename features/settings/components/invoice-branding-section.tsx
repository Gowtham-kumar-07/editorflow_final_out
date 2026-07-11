'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form'
import { Input }    from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from './section-card'
import { updateInvoiceBrandingAction } from '../actions'
import { invoiceBrandingSchema, type InvoiceBrandingValues } from '../schema'
import { settingsKeys } from '../queries/settings-queries'
import type { OrgSettings } from '../types'

interface InvoiceBrandingSectionProps {
  org: OrgSettings
}

export function InvoiceBrandingSection({ org }: InvoiceBrandingSectionProps) {
  const qc = useQueryClient()
  const [colorPreview, setColorPreview] = useState(org.invoice_accent_color ?? '#2563eb')

  const form = useForm<InvoiceBrandingValues>({
    resolver: zodResolver(invoiceBrandingSchema),
    defaultValues: {
      invoice_prefix:       org.invoice_prefix       ?? 'INV',
      invoice_accent_color: org.invoice_accent_color ?? '',
      invoice_footer_text:  org.invoice_footer_text  ?? '',
      invoice_legal_text:   org.invoice_legal_text   ?? '',
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const result = await updateInvoiceBrandingAction(values)

    if (result.ok) {
      toast.success('Invoice branding saved')
      await qc.invalidateQueries({ queryKey: settingsKeys.page() })
      form.reset(values)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <SectionCard
      id="invoice-branding"
      title="Invoice Branding"
      description="Customise how your invoices look and what they say."
      onSave={form.handleSubmit(handleSave)}
      saving={isSubmitting}
      dirty={isDirty}
    >
      <Form {...form}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="invoice_prefix" render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Number Prefix</FormLabel>
              <FormControl>
                <Input placeholder="INV" maxLength={10} {...field} />
              </FormControl>
              <FormDescription>
                Prefix used in invoice numbers, e.g. INV → INV-2026-0001
              </FormDescription>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="invoice_accent_color" render={({ field }) => (
            <FormItem>
              <FormLabel>Accent Color</FormLabel>
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-md border shrink-0"
                  style={{ backgroundColor: colorPreview || '#2563eb' }}
                />
                <FormControl>
                  <Input
                    placeholder="#2563eb"
                    maxLength={7}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                        setColorPreview(e.target.value)
                      }
                    }}
                  />
                </FormControl>
              </div>
              <FormDescription>Hex code, e.g. #2563eb</FormDescription>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="invoice_footer_text" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Footer Text</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Thank you for your business!"
                  className="min-h-[80px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Appears at the bottom of every invoice.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="invoice_legal_text" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Legal / Disclaimer Text</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="This invoice is computer-generated and does not require a physical signature."
                  className="min-h-[80px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Small-print shown at the very bottom of the PDF.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </Form>
    </SectionCard>
  )
}
