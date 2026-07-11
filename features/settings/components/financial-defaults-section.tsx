'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SectionCard } from './section-card'
import { updateFinancialDefaultsAction } from '../actions'
import { financialDefaultsSchema, type FinancialDefaultsValues } from '../schema'
import { settingsKeys } from '../queries/settings-queries'
import type { OrgSettings } from '../types'

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar'     },
  { code: 'EUR', label: 'EUR — Euro'           },
  { code: 'GBP', label: 'GBP — British Pound'  },
  { code: 'INR', label: 'INR — Indian Rupee'   },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AED', label: 'AED — UAE Dirham'    },
]

interface FinancialDefaultsSectionProps {
  org: OrgSettings
}

export function FinancialDefaultsSection({ org }: FinancialDefaultsSectionProps) {
  const qc = useQueryClient()

  const form = useForm<FinancialDefaultsValues>({
    resolver: zodResolver(financialDefaultsSchema),
    defaultValues: {
      default_currency:           org.default_currency           ?? 'USD',
      default_payment_terms_days: org.default_payment_terms_days ?? null,
      default_payroll_currency:   org.default_payroll_currency   ?? 'USD',
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const result = await updateFinancialDefaultsAction(values)

    if (result.ok) {
      toast.success('Financial defaults saved')
      await qc.invalidateQueries({ queryKey: settingsKeys.page() })
      form.reset(values)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <SectionCard
      id="financial"
      title="Financial Defaults"
      description="Default values pre-filled on new invoices."
      onSave={form.handleSubmit(handleSave)}
      saving={isSubmitting}
      dirty={isDirty}
    >
      <Form {...form}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="default_currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="default_payment_terms_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Terms (days)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    placeholder="30"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  Leave blank for no default. E.g. 30 for Net 30.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="default_payroll_currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payroll Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Currency used for internal member payroll.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </SectionCard>
  )
}
