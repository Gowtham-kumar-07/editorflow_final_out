'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Textarea }  from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { invoiceFormSchema, defaultInvoiceValues, type InvoiceFormValues } from '../schema'
import { InvoiceLineItems }      from './invoice-line-items'
import { InvoiceSummary }        from './invoice-summary'
import { ProjectMultiSelector }  from './project-multi-selector'
import { createInvoiceAction, updateInvoiceAction } from '../actions'
import { getProjectsByClient } from '../actions'
import type { InvoiceWithDetails, DiscountType, ProjectOption } from '../types'
import type { ClientOption } from '@/types/client'

// ── helpers ───────────────────────────────────────────────────────────────────

function computeFinancials(values: InvoiceFormValues) {
  const subtotal = (values.line_items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  )
  let discountAmount = 0
  if (values.discount_type === 'percent') {
    discountAmount = Math.round(subtotal * Math.min(values.discount_value, 100) / 100 * 100) / 100
  } else {
    discountAmount = Math.round(Math.min(values.discount_value, subtotal) * 100) / 100
  }
  const taxable   = subtotal - discountAmount
  const taxAmount = Math.round(taxable * Math.min(values.tax_rate, 100) / 100 * 100) / 100
  return { subtotal, discountAmount, taxAmount, total: taxable + taxAmount }
}

function invoiceToFormValues(inv: InvoiceWithDetails): InvoiceFormValues {
  return {
    client_id:      inv.client_id,
    project_ids:    inv.projects.map((p) => p.id),
    issue_date:     inv.issue_date,
    due_date:       inv.due_date   ?? '',
    currency:       inv.currency,
    discount_type:  (inv.discount_type as DiscountType) ?? 'fixed',
    discount_value: Number(inv.discount_value ?? 0),
    tax_rate:       Number(inv.tax_rate       ?? 0),
    notes:          inv.notes         ?? '',
    payment_terms:  inv.payment_terms ?? '',
    line_items:     inv.items.length
      ? inv.items.map((it) => ({
          description: it.description,
          quantity:    Number(it.quantity),
          unit_price:  Number(it.unit_price),
          project_id:  it.project_id ?? null,
        }))
      : [{ description: '', quantity: 1, unit_price: 0, project_id: null }],
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props =
  | { mode: 'create'; clients: ClientOption[]; orgId: string; defaultCurrency?: string | null; defaultPaymentTermsDays?: number | null }
  | { mode: 'edit';   invoice: InvoiceWithDetails; clients: ClientOption[]; orgId: string; defaultCurrency?: string | null; defaultPaymentTermsDays?: number | null }

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceForm(props: Props) {
  const router      = useRouter()
  const [serverError,    setServerError]    = useState<string | null>(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [showDiscard,    setShowDiscard]    = useState(false)
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  const form = useForm<InvoiceFormValues>({
    resolver:      zodResolver(invoiceFormSchema),
    defaultValues: props.mode === 'edit'
      ? invoiceToFormValues(props.invoice)
      : defaultInvoiceValues({
          defaultCurrency:         props.defaultCurrency,
          defaultPaymentTermsDays: props.defaultPaymentTermsDays,
        }),
  })

  const { isDirty } = form.formState
  const watchedClientId = useWatch({ control: form.control, name: 'client_id' })
  const watchedValues   = useWatch({ control: form.control })
  const { subtotal, discountAmount, taxAmount, total } = computeFinancials(watchedValues as InvoiceFormValues)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Fetch project options when client changes
  useEffect(() => {
    if (!watchedClientId) {
      setProjectOptions([])
      if (props.mode === 'create') {
        form.setValue('project_ids', [])
      }
      return
    }
    let cancelled = false
    setLoadingProjects(true)
    getProjectsByClient(watchedClientId)
      .then((p) => { if (!cancelled) setProjectOptions(p) })
      .catch(() => { if (!cancelled) setProjectOptions([]) })
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedClientId])

  // In edit mode, seed project options on mount
  useEffect(() => {
    if (props.mode === 'edit' && props.invoice.client_id) {
      getProjectsByClient(props.invoice.client_id)
        .then(setProjectOptions)
        .catch(() => setProjectOptions([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle project toggle — add or remove project-derived line item
  const handleProjectToggle = useCallback((project: ProjectOption) => {
    const currentIds  = form.getValues('project_ids')
    const currentItems = form.getValues('line_items')

    if (currentIds.includes(project.id)) {
      // ── Deselect: remove project link and its line item ──────────────
      form.setValue('project_ids', currentIds.filter((id) => id !== project.id))
      const idx = currentItems.findIndex((it) => it.project_id === project.id)
      if (idx !== -1) {
        const updated = currentItems.filter((_, i) => i !== idx)
        form.setValue('line_items', updated.length ? updated : [
          { description: '', quantity: 1, unit_price: 0, project_id: null }
        ])
      }
    } else {
      // ── Select: add project link and its snapshot line item ──────────
      form.setValue('project_ids', [...currentIds, project.id])
      const existing = currentItems

      // If the only item is a blank placeholder, replace it
      const isBlankPlaceholder =
        existing.length === 1 &&
        !existing[0].description &&
        !existing[0].project_id &&
        existing[0].quantity === 1 &&
        existing[0].unit_price === 0

      const newItem = {
        description: project.name,
        quantity:    1,
        unit_price:  project.budget ?? 0,
        project_id:  project.id,
      }

      form.setValue(
        'line_items',
        isBlankPlaceholder ? [newItem] : [...existing, newItem]
      )
    }
  }, [form])

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true)
    setServerError(null)
    try {
      if (props.mode === 'create') {
        const result = await createInvoiceAction(values)
        if (!result.ok) { setServerError(result.error); return }
        toast.success(`Invoice ${result.data.invoice_number} created`)
        router.push(`/invoices/${result.data.id}`)
      } else {
        const result = await updateInvoiceAction(props.invoice.id, values)
        if (!result.ok) { setServerError(result.error); return }
        toast.success('Invoice updated')
        router.push(`/invoices/${props.invoice.id}`)
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const currency = watchedValues.currency ?? 'USD'

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* ── Section 1: Invoice Details ─────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Invoice Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client */}
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v)
                        // Clear project selections when client changes
                        form.setValue('project_ids', [])
                        const items = form.getValues('line_items')
                        // Remove all project-derived items; keep manual ones
                        const kept = items.filter((it) => !it.project_id)
                        form.setValue(
                          'line_items',
                          kept.length ? kept : [{ description: '', quantity: 1, unit_price: 0, project_id: null }]
                        )
                      }}
                      value={field.value}
                      disabled={props.mode === 'edit'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Projects — multi-select */}
              <FormField
                control={form.control}
                name="project_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projects</FormLabel>
                    <ProjectMultiSelector
                      projects={projectOptions}
                      selectedIds={field.value}
                      onToggle={handleProjectToggle}
                      currency={currency}
                      disabled={!watchedClientId || props.mode === 'edit'}
                      loading={loadingProjects}
                    />
                    {props.mode === 'edit' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Projects cannot be changed after creation.
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Issue Date */}
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                        <SelectItem value="GBP">GBP — British Pound</SelectItem>
                        <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                        <SelectItem value="CAD">CAD — Canadian Dollar</SelectItem>
                        <SelectItem value="AUD">AUD — Australian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Separator />

          {/* ── Section 2: Line Items ──────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Line Items
            </h2>
            <InvoiceLineItems currency={currency} />
            {form.formState.errors.line_items?.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.line_items.root.message}
              </p>
            )}
          </section>

          <Separator />

          {/* ── Section 3: Discount & Tax ──────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Discount &amp; Tax
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percent">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Discount{' '}
                      {watchedValues.discount_type === 'percent' ? '(%)' : `(${currency})`}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ── Live Summary ───────────────────────────────────────── */}
          <InvoiceSummary
            subtotal={subtotal}
            discountType={watchedValues.discount_type as DiscountType}
            discountValue={Number(watchedValues.discount_value ?? 0)}
            discountAmount={discountAmount}
            taxRate={Number(watchedValues.tax_rate ?? 0)}
            taxAmount={taxAmount}
            total={total}
            currency={currency}
          />

          <Separator />

          {/* ── Section 4: Additional Information ─────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Additional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select or leave blank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 45">Net 45</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes, payment instructions, or terms…"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {props.mode === 'create' ? 'Create Invoice' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                if (isDirty) { setShowDiscard(true) } else { router.back() }
              }}
            >
              Cancel
            </Button>
          </div>

        </form>
      </Form>

      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. They will be lost if you leave this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.back()}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  )
}
