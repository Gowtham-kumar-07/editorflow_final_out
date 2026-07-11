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
import { updateOrgProfileAction } from '../actions'
import { orgProfileSchema, type OrgProfileFormValues } from '../schema'
import { settingsKeys } from '../queries/settings-queries'
import type { OrgSettings } from '../types'

interface OrgProfileSectionProps {
  org: OrgSettings
}

export function OrgProfileSection({ org }: OrgProfileSectionProps) {
  const qc = useQueryClient()

  const form = useForm<OrgProfileFormValues>({
    resolver: zodResolver(orgProfileSchema),
    defaultValues: {
      name:           org.name               ?? '',
      tagline:        org.tagline             ?? '',
      business_email: org.business_email      ?? '',
      business_phone: org.business_phone      ?? '',
      website:        org.website             ?? '',
      address_line1:  org.address_line1       ?? '',
      address_line2:  org.address_line2       ?? '',
      city:           org.city                ?? '',
      state:          org.state               ?? '',
      postal_code:    org.postal_code         ?? '',
      country:        org.country             ?? '',
      tax_id:         org.tax_id              ?? '',
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const result = await updateOrgProfileAction(values)

    if (result.ok) {
      toast.success('Organization profile saved')
      await qc.invalidateQueries({ queryKey: settingsKeys.page() })
      form.reset(values)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <SectionCard
      id="org-profile"
      title="Organization Profile"
      description="Business details shown on invoices and receipts."
      onSave={form.handleSubmit(handleSave)}
      saving={isSubmitting}
      dirty={isDirty}
    >
      <Form {...form}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Organization Name *</FormLabel>
              <FormControl><Input placeholder="Acme Studio" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="tagline" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Tagline</FormLabel>
              <FormControl><Input placeholder="Crafting visual stories since 2020" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="business_email" render={({ field }) => (
            <FormItem>
              <FormLabel>Business Email</FormLabel>
              <FormControl><Input type="email" placeholder="hello@studio.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="business_phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Business Phone</FormLabel>
              <FormControl><Input type="tel" placeholder="+91 98765 43210" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="website" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Website</FormLabel>
              <FormControl><Input type="url" placeholder="https://yourstudio.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="address_line1" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Address Line 1</FormLabel>
              <FormControl><Input placeholder="123 Studio Lane" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="address_line2" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Address Line 2</FormLabel>
              <FormControl><Input placeholder="Suite 4B" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="Mumbai" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem>
              <FormLabel>State / Province</FormLabel>
              <FormControl><Input placeholder="Maharashtra" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="postal_code" render={({ field }) => (
            <FormItem>
              <FormLabel>Postal Code</FormLabel>
              <FormControl><Input placeholder="400001" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input placeholder="India" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="tax_id" render={({ field }) => (
            <FormItem>
              <FormLabel>GST / Tax ID</FormLabel>
              <FormControl><Input placeholder="22AAAAA0000A1Z5" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </Form>
    </SectionCard>
  )
}
